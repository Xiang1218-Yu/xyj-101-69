import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RotateCw, Volume2, VolumeX, Trophy, Grid3X3, Grip } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const PICTURE_BOOK_EMOJIS = [
  "🐱", "🐶", "🐰", "🐼", "🦊", "🐨", "🐯", "🦁",
  "🐸", "🐷", "🐮", "🐔", "🦋", "🐝", "🐢", "🐙",
  "🌸", "🌺", "🌻", "🌷", "🌈", "⭐", "🌙", "☀️",
  "🍎", "🍰", "🎈", "🎁", "💎", "👑", "🔮", "🎀",
  "🦄", "🐘", "🦒", "🐧",
];

const DIFFICULTY_OPTIONS = [
  { value: 4, label: "简单", icon: Grid3X3, pairs: 8 },
  { value: 6, label: "困难", icon: Grip, pairs: 18 },
];

const STAR_POSITIONS = [
  { top: "8%", left: "5%", delay: "0s" },
  { top: "12%", right: "8%", delay: "0.5s" },
  { top: "85%", left: "10%", delay: "1s" },
  { top: "80%", right: "6%", delay: "1.5s" },
  { top: "45%", left: "3%", delay: "0.7s" },
  { top: "50%", right: "3%", delay: "1.2s" },
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function MatchGame() {
  const navigate = useNavigate();
  const { storyBook } = useStore();
  const [gridSize, setGridSize] = useState(4);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback(
    (type: "flip" | "match" | "mismatch" | "complete") => {
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
        case "flip":
          oscillator.frequency.value = 500;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.08);
          break;
        case "match":
          oscillator.frequency.value = 700;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.2);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 900;
            osc2.type = "sine";
            gain2.gain.setValueAtTime(0.2, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.15);
          }, 100);
          break;
        case "mismatch":
          oscillator.frequency.value = 300;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
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

  const initGame = useCallback((size: number) => {
    const pairs = (size * size) / 2;
    const selectedEmojis = shuffleArray(PICTURE_BOOK_EMOJIS).slice(0, pairs);
    const cardPairs = [...selectedEmojis, ...selectedEmojis];
    const shuffled = shuffleArray(cardPairs);

    const newCards: Card[] = shuffled.map((emoji, i) => ({
      id: i,
      emoji,
      isFlipped: false,
      isMatched: false,
    }));

    setCards(newCards);
    setFlippedIds([]);
    setMoves(0);
    setMatchedPairs(0);
    setTotalPairs(pairs);
    setIsComplete(false);
    setIsChecking(false);
    setElapsedTime(0);
    setGameStarted(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startGame = (size: number) => {
    setGridSize(size);
    initGame(size);
    setShowDifficultySelect(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameStarted && !isComplete) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [gameStarted, isComplete]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCardClick = (cardId: number) => {
    if (isChecking) return;
    if (isComplete) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    if (flippedIds.includes(cardId)) return;

    if (!gameStarted) {
      setGameStarted(true);
    }

    playSound("flip");

    const newFlipped = [...flippedIds, cardId];
    setFlippedIds(newFlipped);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
    );

    if (newFlipped.length === 2) {
      setIsChecking(true);
      setMoves((m) => m + 1);

      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find((c) => c.id === firstId)!;
      const secondCard = cards.find((c) => c.id === secondId)!;

      if (firstCard.emoji === secondCard.emoji) {
        playSound("match");
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isMatched: true }
                : c
            )
          );
          setMatchedPairs((prev) => {
            const newMatched = prev + 1;
            if (newMatched === totalPairs) {
              setIsComplete(true);
              setTimeout(() => playSound("complete"), 200);
            }
            return newMatched;
          });
          setFlippedIds([]);
          setIsChecking(false);
        }, 400);
      } else {
        playSound("mismatch");
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setFlippedIds([]);
          setIsChecking(false);
        }, 800);
      }
    }
  };

  if (!storyBook) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-warm-brown/60 text-lg mb-6">请先创建绘本再玩连连看游戏</p>
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

          <h1 className="font-display text-xl text-warm-brown">🃏 绘本连连看</h1>

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
              <div className="text-6xl mb-4">🃏</div>
              <h2 className="font-display text-2xl text-warm-brown mb-2">选择难度</h2>
              <p className="text-warm-brown/60 text-sm">翻开卡片，找到相同的图案配对</p>
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
                        {option.value} × {option.value} · {option.pairs} 对
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
                <span className="text-sm text-warm-brown/60">⏱</span>
                <span className="text-sm text-warm-brown">{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-warm-brown/60">
                  配对: {matchedPairs}/{totalPairs}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-warm-brown">步数: {moves}</span>
                <button
                  onClick={() => {
                    initGame(gridSize);
                  }}
                  className="p-1.5 rounded-full bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors"
                  title="重新开始"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            className="w-full max-w-lg grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.isFlipped || card.isMatched || isChecking}
                className={cn(
                  "aspect-square rounded-xl text-3xl md:text-4xl flex items-center justify-center transition-all duration-300 select-none",
                  card.isMatched
                    ? "bg-green-100 scale-0 opacity-0 pointer-events-none"
                    : card.isFlipped
                    ? "bg-white shadow-lg scale-105 ring-2 ring-coral/30 cursor-default"
                    : "bg-gradient-to-br from-coral to-purple-400 shadow-md hover:shadow-lg hover:scale-105 cursor-pointer active:scale-95"
                )}
                style={{
                  transition: "transform 0.3s, opacity 0.3s, background 0.3s, box-shadow 0.3s",
                }}
              >
                {card.isFlipped || card.isMatched ? (
                  <span className="animate-scale-in">{card.emoji}</span>
                ) : (
                  <span className="text-white/80 text-2xl">?</span>
                )}
              </button>
            ))}
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
              className="px-5 py-2.5 rounded-full bg-coral text-white hover:bg-coral-dark transition-colors text-sm shadow-md"
            >
              返回绘本
            </button>
          </div>
        </>
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
            <p className="text-warm-brown/60 mb-4">你成功完成了连连看！</p>
            <div className="bg-gradient-to-r from-coral/10 to-purple-400/10 rounded-2xl p-4 mb-6">
              <div className="flex justify-around">
                <div className="text-center">
                  <p className="text-2xl font-display text-coral">{moves}</p>
                  <p className="text-xs text-warm-brown/60">总步数</p>
                </div>
                <div className="w-px bg-warm-brown/20" />
                <div className="text-center">
                  <p className="text-2xl font-display text-purple-500">{formatTime(elapsedTime)}</p>
                  <p className="text-xs text-warm-brown/60">用时</p>
                </div>
                <div className="w-px bg-warm-brown/20" />
                <div className="text-center">
                  <p className="text-2xl font-display text-mint">{gridSize}×{gridSize}</p>
                  <p className="text-xs text-warm-brown/60">难度</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => initGame(gridSize)}
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
