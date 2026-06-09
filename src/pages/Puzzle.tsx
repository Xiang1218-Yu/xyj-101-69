import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, RotateCw, ChevronLeft, Volume2, VolumeX, Trophy, Star, Grid3X3, Grid2X2, Grip } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface PuzzlePiece {
  id: number;
  currentIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

interface Position {
  x: number;
  y: number;
}

const DIFFICULTY_OPTIONS = [
  { value: 3, label: "简单", icon: Grid2X2 },
  { value: 4, label: "中等", icon: Grid3X3 },
  { value: 5, label: "困难", icon: Grip },
];

const STAR_POSITIONS = [
  { top: "8%", left: "5%", delay: "0s" },
  { top: "12%", right: "8%", delay: "0.5s" },
  { top: "85%", left: "10%", delay: "1s" },
  { top: "80%", right: "6%", delay: "1.5s" },
  { top: "45%", left: "3%", delay: "0.7s" },
  { top: "50%", right: "3%", delay: "1.2s" },
];

export default function Puzzle() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storyBook } = useStore();
  const [gridSize, setGridSize] = useState(3);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [draggedPiece, setDraggedPiece] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

  const boardRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pageIndex = parseInt(searchParams.get("page") || "0", 10);

  const currentPage = storyBook?.pages[pageIndex];
  const imageUrl = currentPage?.illustrationUrl || "";

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback(
    (type: "pick" | "drop" | "snap" | "complete") => {
      if (!soundEnabled) return;
      const ctx = initAudio();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      switch (type) {
        case "pick":
          oscillator.frequency.value = 600;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.1);
          break;
        case "drop":
          oscillator.frequency.value = 400;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.08);
          break;
        case "snap":
          oscillator.frequency.value = 800;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
          break;
        case "complete": {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = "sine";
            gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.3);
          });
          break;
        }
      }
    },
    [soundEnabled, initAudio]
  );

  const shufflePieces = useCallback(() => {
    const totalPieces = gridSize * gridSize;
    const newPieces: PuzzlePiece[] = Array.from({ length: totalPieces }, (_, i) => ({
      id: i,
      currentIndex: i,
      correctIndex: i,
      isCorrect: true,
    }));

    for (let i = newPieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newPieces[i], newPieces[j]] = [newPieces[j], newPieces[i]];
      newPieces[i].currentIndex = i;
      newPieces[j].currentIndex = j;
      newPieces[i].isCorrect = newPieces[i].currentIndex === newPieces[i].correctIndex;
      newPieces[j].isCorrect = newPieces[j].currentIndex === newPieces[j].correctIndex;
    }

    const allCorrect = newPieces.every((p) => p.isCorrect);
    if (allCorrect && totalPieces > 1) {
      [newPieces[0], newPieces[1]] = [newPieces[1], newPieces[0]];
      newPieces[0].currentIndex = 0;
      newPieces[1].currentIndex = 1;
      newPieces[0].isCorrect = false;
      newPieces[1].isCorrect = false;
    }

    setPieces(newPieces);
    setMoves(0);
    setIsComplete(false);
    setPreviewPosition(null);
  }, [gridSize]);

  const startGame = (size: number) => {
    setGridSize(size);
    setShowDifficultySelect(false);
  };

  useEffect(() => {
    if (!showDifficultySelect && imageUrl) {
      shufflePieces();
    }
  }, [gridSize, showDifficultySelect, imageUrl, shufflePieces]);

  const handleMouseDown = (e: React.MouseEvent, pieceId: number) => {
    e.preventDefault();
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece || piece.isCorrect || isComplete) return;

    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const pieceSize = rect.width / gridSize;
      const col = piece.currentIndex % gridSize;
      const row = Math.floor(piece.currentIndex / gridSize);
      const pieceX = rect.left + col * pieceSize;
      const pieceY = rect.top + row * pieceSize;

      setDragOffset({
        x: e.clientX - pieceX,
        y: e.clientY - pieceY,
      });
    }

    setDraggedPiece(pieceId);
    playSound("pick");
  };

  const handleTouchStart = (e: React.TouchEvent, pieceId: number) => {
    e.preventDefault();
    const touch = e.touches[0];
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece || piece.isCorrect || isComplete) return;

    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const pieceSize = rect.width / gridSize;
      const col = piece.currentIndex % gridSize;
      const row = Math.floor(piece.currentIndex / gridSize);
      const pieceX = rect.left + col * pieceSize;
      const pieceY = rect.top + row * pieceSize;

      setDragOffset({
        x: touch.clientX - pieceX,
        y: touch.clientY - pieceY,
      });
    }

    setDraggedPiece(pieceId);
    playSound("pick");
  };

  const getDropTarget = (clientX: number, clientY: number): number | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const pieceSize = rect.width / gridSize;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) {
      return null;
    }

    const col = Math.floor(x / pieceSize);
    const row = Math.floor(y / pieceSize);
    return row * gridSize + col;
  };

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (draggedPiece === null) return;

      setMousePosition({ x: clientX, y: clientY });

      const dropTarget = getDropTarget(clientX, clientY);
      if (dropTarget !== null && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const pieceSize = rect.width / gridSize;
        const col = dropTarget % gridSize;
        const row = Math.floor(dropTarget / gridSize);
        setPreviewPosition({
          x: col * pieceSize,
          y: row * pieceSize,
        });
      } else {
        setPreviewPosition(null);
      }
    },
    [draggedPiece, gridSize]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleDrop = useCallback(
    (clientX: number, clientY: number) => {
      if (draggedPiece === null) return;

      const dropTarget = getDropTarget(clientX, clientY);
      const draggedPieceObj = pieces.find((p) => p.id === draggedPiece);

      if (dropTarget !== null && draggedPieceObj) {
        const targetPiece = pieces.find((p) => p.currentIndex === dropTarget);

        if (targetPiece && targetPiece.id !== draggedPiece) {
          const newPieces = pieces.map((p) => {
            if (p.id === draggedPiece) {
              const newIndex = dropTarget;
              return {
                ...p,
                currentIndex: newIndex,
                isCorrect: newIndex === p.correctIndex,
              };
            }
            if (p.id === targetPiece.id) {
              const newIndex = draggedPieceObj.currentIndex;
              return {
                ...p,
                currentIndex: newIndex,
                isCorrect: newIndex === p.correctIndex,
              };
            }
            return p;
          });

          setPieces(newPieces);
          setMoves((m) => m + 1);

          const wasCorrect =
            draggedPieceObj.currentIndex === draggedPieceObj.correctIndex ||
            targetPiece.currentIndex === targetPiece.correctIndex;
          const isNowCorrect =
            dropTarget === draggedPieceObj.correctIndex ||
            draggedPieceObj.currentIndex === targetPiece.correctIndex;

          if (isNowCorrect && !wasCorrect) {
            playSound("snap");
          } else {
            playSound("drop");
          }

          const allCorrect = newPieces.every((p) => p.isCorrect);
          if (allCorrect) {
            setIsComplete(true);
            setTimeout(() => playSound("complete"), 200);
          }
        } else {
          playSound("drop");
        }
      } else {
        playSound("drop");
      }

      setDraggedPiece(null);
      setPreviewPosition(null);
    },
    [draggedPiece, pieces, playSound]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      handleDrop(e.clientX, e.clientY);
    },
    [handleDrop]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (e.changedTouches.length > 0) {
        handleDrop(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    },
    [handleDrop]
  );

  useEffect(() => {
    if (draggedPiece !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [draggedPiece, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const getPieceStyle = (piece: PuzzlePiece) => {
    const col = piece.correctIndex % gridSize;
    const row = Math.floor(piece.correctIndex / gridSize);

    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: `${gridSize * 100}%`,
      backgroundPosition: `${(col / (gridSize - 1)) * 100}% ${(row / (gridSize - 1)) * 100}%`,
    };
  };

  const getPiecePosition = (piece: PuzzlePiece) => {
    if (draggedPiece === piece.id && boardRef.current) {
      return null;
    }
    const col = piece.currentIndex % gridSize;
    const row = Math.floor(piece.currentIndex / gridSize);
    return {
      left: `${(col / gridSize) * 100}%`,
      top: `${(row / gridSize) * 100}%`,
    };
  };

  const getDraggedPieceStyle = () => {
    if (draggedPiece === null || !boardRef.current) return {};
    const rect = boardRef.current.getBoundingClientRect();
    return {
      left: 0,
      top: 0,
      width: rect.width / gridSize,
      height: rect.height / gridSize,
    };
  };

  if (!storyBook || !currentPage) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-warm-brown/60 text-lg mb-6">请先创建绘本再玩拼图游戏</p>
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 bg-coral text-white font-display rounded-full hover:bg-coral-dark transition-colors"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream font-body flex flex-col items-center px-4 py-6 relative overflow-hidden">
      {STAR_POSITIONS.map((star, i) => (
        <span
          key={i}
          className="absolute text-xl animate-twinkle select-none pointer-events-none"
          style={{
            top: star.top,
            left: "left" in star ? star.left : undefined,
            right: "right" in star ? star.right : undefined,
            animationDelay: star.delay,
          }}
        >
          ⭐
        </span>
      ))}

      <div className="w-full max-w-2xl mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-warm-brown/70 hover:text-warm-brown transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>

          <h1 className="font-display text-xl text-warm-brown">🧩 绘本拼图</h1>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 text-warm-brown/70 hover:text-warm-brown transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {showDifficultySelect ? (
        <div className="flex-1 flex items-center justify-center w-full max-w-lg">
          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 w-full animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🧩</div>
              <h2 className="font-display text-2xl text-warm-brown mb-2">选择难度</h2>
              <p className="text-warm-brown/60 text-sm">选择拼图的难度级别</p>
            </div>

            <div className="space-y-3">
              {DIFFICULTY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => startGame(option.value)}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-coral/10 to-purple-400/10 hover:from-coral/20 hover:to-purple-400/20 transition-all flex items-center gap-4 group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-coral" />
                    </div>
                    <div className="text-left">
                      <p className="font-display text-lg text-warm-brown">{option.label}</p>
                      <p className="text-sm text-warm-brown/60">
                        {option.value} × {option.value} 格
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => navigate("/book")}
              className="w-full mt-6 py-3 text-warm-brown/60 hover:text-warm-brown transition-colors text-sm"
            >
              返回绘本阅读
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="w-full max-w-lg mb-4">
            <div className="bg-white/80 backdrop-blur rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm text-warm-brown">步数: {moves}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-warm-brown/60">
                  正确: {pieces.filter((p) => p.isCorrect).length}/{pieces.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHint(!showHint)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs transition-colors",
                    showHint
                      ? "bg-coral text-white"
                      : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
                  )}
                >
                  {showHint ? "隐藏提示" : "显示提示"}
                </button>
                <button
                  onClick={shufflePieces}
                  className="p-1.5 rounded-full bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors"
                  title="重新打乱"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {showHint && (
            <div className="w-full max-w-xs mb-4">
              <div className="bg-white/80 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-xs text-warm-brown/60 mb-2">参考图</p>
                <img
                  src={imageUrl}
                  alt="参考图"
                  className="w-full rounded-lg shadow-sm"
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>
          )}

          <div className="relative w-full max-w-lg aspect-square">
            <div
              ref={boardRef}
              className="absolute inset-0 bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-coral/20"
            >
              {pieces.map((piece) => {
                const position = getPiecePosition(piece);
                const isDragged = draggedPiece === piece.id;

                return (
                  <div
                    key={piece.id}
                    className={cn(
                      "absolute transition-all duration-200 cursor-grab active:cursor-grabbing",
                      piece.isCorrect && "ring-2 ring-green-400 ring-inset",
                      isDragged && "opacity-0"
                    )}
                    style={{
                      width: `${100 / gridSize}%`,
                      height: `${100 / gridSize}%`,
                      ...position,
                      ...getPieceStyle(piece),
                      zIndex: piece.isCorrect ? 1 : 2,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, piece.id)}
                    onTouchStart={(e) => handleTouchStart(e, piece.id)}
                  >
                    <div className="w-full h-full border border-white/20" />
                  </div>
                );
              })}

              {previewPosition !== null && (
                <div
                  className="absolute bg-coral/30 rounded-lg pointer-events-none transition-all duration-75"
                  style={{
                    width: `${100 / gridSize}%`,
                    height: `${100 / gridSize}%`,
                    left: `${(previewPosition.x / (boardRef.current?.clientWidth || 1)) * 100}%`,
                    top: `${(previewPosition.y / (boardRef.current?.clientHeight || 1)) * 100}%`,
                    zIndex: 3,
                  }}
                />
              )}

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "cover",
                  opacity: showHint ? 0.15 : 0,
                  transition: "opacity 0.3s",
                }}
              />
            </div>
          </div>

          <div className="w-full max-w-lg mt-4 flex justify-center gap-3">
            <button
              onClick={() => setShowDifficultySelect(true)}
              className="px-5 py-2.5 rounded-full bg-white/80 text-warm-brown hover:bg-white transition-colors text-sm shadow-md"
            >
              更换难度
            </button>
            <button
              onClick={() => navigate("/book")}
              className="px-5 py-2.5 rounded-full bg-coral text-white hover:bg-coral-dark transition-colors text-sm shadow-md flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              返回绘本
            </button>
          </div>
        </>
      )}

      {draggedPiece !== null && (
        <div
          className="fixed pointer-events-none z-50 shadow-2xl rounded-lg overflow-hidden"
          style={{
            ...getDraggedPieceStyle(),
            transform: `translate(calc(${mousePosition.x}px - ${dragOffset.x}px - 50%), calc(${mousePosition.y}px - ${dragOffset.y}px - 50%))`,
            ...getPieceStyle(pieces.find((p) => p.id === draggedPiece)!),
          }}
        />
      )}

      {isComplete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm mx-4 animate-scale-in">
            <div className="relative mb-6">
              <Trophy className="w-20 h-20 mx-auto text-yellow-500 animate-bounce" />
              <div className="absolute inset-0 flex items-center justify-center">
                {[...Array(8)].map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-2xl animate-ping"
                    style={{
                      transform: `rotate(${i * 45}deg) translateY(-40px)`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    ✨
                  </span>
                ))}
              </div>
            </div>
            <h2 className="font-display text-3xl text-warm-brown mb-2">太棒了！</h2>
            <p className="text-warm-brown/60 mb-4">你成功完成了拼图！</p>
            <div className="bg-gradient-to-r from-coral/10 to-purple-400/10 rounded-2xl p-4 mb-6">
              <div className="flex justify-around">
                <div className="text-center">
                  <p className="text-2xl font-display text-coral">{moves}</p>
                  <p className="text-xs text-warm-brown/60">总步数</p>
                </div>
                <div className="w-px bg-warm-brown/20" />
                <div className="text-center">
                  <p className="text-2xl font-display text-purple-500">
                    {gridSize}×{gridSize}
                  </p>
                  <p className="text-xs text-warm-brown/60">难度</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={shufflePieces}
                className="flex-1 py-3 rounded-2xl bg-warm-brown/10 text-warm-brown font-display hover:bg-warm-brown/20 transition-colors"
              >
                再玩一次
              </button>
              <button
                onClick={() => navigate("/book")}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-coral to-purple-500 text-white font-display hover:shadow-lg transition-all"
              >
                返回绘本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
