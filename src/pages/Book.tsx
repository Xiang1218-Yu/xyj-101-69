import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Home, BookOpen, Palette as PaletteIcon, X, RotateCw, Trash2, Minus, Plus, Settings, FileText, Image, Layers, Puzzle, Moon, Clock, StopCircle, Grid3X3 } from "lucide-react";
import { useStore } from "@/store/useStore";
import BedtimeSettings from "@/components/BedtimeSettings";
import GoodNightScreen from "@/components/GoodNightScreen";
import {
  exportBookToPDF,
  estimateExportFileSize,
  formatFileSize,
  PAPER_LABELS,
  ORIENTATION_LABELS,
  QUALITY_SETTINGS,
  type ExportOptions,
  type ExportProgress,
  type PaperSize,
  type PageOrientation,
  type ImageQuality,
} from "@/utils/pdfExport";
import type { Sticker } from "@/store/useStore";

const starDecorations = [
  { emoji: "⭐", top: "10%", left: "8%", delay: "0s" },
  { emoji: "✨", top: "20%", right: "10%", delay: "1s" },
  { emoji: "💫", top: "70%", left: "5%", delay: "2s" },
  { emoji: "⭐", top: "80%", right: "8%", delay: "0.5s" },
  { emoji: "✨", top: "45%", left: "3%", delay: "1.5s" },
  { emoji: "💫", top: "50%", right: "4%", delay: "2.5s" },
];

const stickerCategories = {
  stars: ["⭐", "✨", "💫", "🌟", "⭐", "🌙", "☀️", "🌈"],
  hearts: ["❤️", "💕", "💖", "💗", "💓", "💝", "🩷", "💘"],
  animals: ["🐱", "🐶", "🐰", "🐼", "🦊", "🐨", "🐯", "🦁"],
  flowers: ["🌸", "🌺", "🌻", "🌷", "🌹", "💐", "🌼", "🪻"],
  food: ["🍎", "🍰", "🧁", "🍭", "🍪", "🍩", "🧋", "🍦"],
  others: ["🎈", "🎉", "🎀", "🎁", "💎", "👑", "🦋", "🔮"],
};

export default function Book() {
  const navigate = useNavigate();
  const { storyBook, resetAll, addSticker, updateSticker, deleteSticker, bedtimeSettings, stopBedtimeMode, updateBrightness, showGoodNightScreen } = useStore();
  const [currentPage, setCurrentPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [showBedtimeSettings, setShowBedtimeSettings] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<keyof typeof stickerCategories>("stars");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    paperSize: "a4",
    orientation: "landscape",
    includeCover: true,
    includeBack: true,
    imageQuality: "high",
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage > 0) {
        setCurrentPage((prev) => prev - 1);
      } else if (e.key === "ArrowRight" && storyBook && currentPage < storyBook.pages.length - 1) {
        setCurrentPage((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, storyBook]);

  useEffect(() => {
    if (!bedtimeSettings.enabled || !bedtimeSettings.startTime) return;

    const durationMs = bedtimeSettings.duration * 60 * 1000;
    let animationFrameId: number;

    const updateBedtimeMode = () => {
      const elapsed = Date.now() - bedtimeSettings.startTime!;
      const remaining = Math.max(0, durationMs - elapsed);
      setRemainingTime(remaining);

      const fadeStartRatio = 0.7;
      const fadeStartTime = durationMs * fadeStartRatio;

      if (elapsed >= fadeStartTime) {
        const fadeProgress = (elapsed - fadeStartTime) / (durationMs - fadeStartTime);
        const newBrightness = Math.max(0.15, 1 - fadeProgress * 0.85);
        updateBrightness(newBrightness);
      }

      if (remaining <= 0) {
        showGoodNightScreen();
        return;
      }

      animationFrameId = requestAnimationFrame(updateBedtimeMode);
    };

    animationFrameId = requestAnimationFrame(updateBedtimeMode);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [bedtimeSettings.enabled, bedtimeSettings.startTime, bedtimeSettings.duration, updateBrightness, showGoodNightScreen]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleStopBedtimeMode = () => {
    stopBedtimeMode();
    setRemainingTime(0);
  };



  const handleStickerDragStart = (e: React.DragEvent, emoji: string) => {
    e.dataTransfer.setData("stickerEmoji", emoji);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const emoji = e.dataTransfer.getData("stickerEmoji");
      if (!emoji || !pageRef.current || !storyBook) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const newSticker: Sticker = {
        id: `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        emoji,
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(5, Math.min(95, y)),
        rotation: 0,
        scale: 1,
      };

      addSticker(currentPage, newSticker);
    },
    [currentPage, addSticker, storyBook]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleStickerMouseDown = (e: React.MouseEvent, sticker: Sticker) => {
    e.stopPropagation();
    setSelectedStickerId(sticker.id);
    setDraggingSticker(sticker.id);

    if (pageRef.current) {
      const rect = pageRef.current.getBoundingClientRect();
      const stickerX = (sticker.x / 100) * rect.width;
      const stickerY = (sticker.y / 100) * rect.height;
      setDragOffset({
        x: e.clientX - rect.left - stickerX,
        y: e.clientY - rect.top - stickerY,
      });
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingSticker || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      updateSticker(currentPage, draggingSticker, {
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(5, Math.min(95, y)),
      });
    },
    [draggingSticker, dragOffset, currentPage, updateSticker]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingSticker(null);
  }, []);

  useEffect(() => {
    if (draggingSticker) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingSticker, handleMouseMove, handleMouseUp]);

  const handleRotateSticker = (stickerId: string) => {
    const page = storyBook?.pages[currentPage];
    const sticker = page?.stickers.find((s) => s.id === stickerId);
    if (sticker) {
      updateSticker(currentPage, stickerId, {
        rotation: (sticker.rotation + 45) % 360,
      });
    }
  };

  const handleScaleSticker = (stickerId: string, delta: number) => {
    const page = storyBook?.pages[currentPage];
    const sticker = page?.stickers.find((s) => s.id === stickerId);
    if (sticker) {
      const newScale = Math.max(0.5, Math.min(2, sticker.scale + delta));
      updateSticker(currentPage, stickerId, { scale: newScale });
    }
  };

  const handleDeleteSticker = (stickerId: string) => {
    deleteSticker(currentPage, stickerId);
    setSelectedStickerId(null);
  };

  const handlePageClick = () => {
    setSelectedStickerId(null);
  };

  useEffect(() => {
    setSelectedStickerId(null);
  }, [currentPage]);

  const estimatedFileSize = useMemo(() => {
    if (!storyBook) return 0;
    return estimateExportFileSize(storyBook.pages, exportOptions);
  }, [storyBook, exportOptions]);

  const effectivePageCount = useMemo(() => {
    if (!storyBook) return 0;
    let count = storyBook.pages.length;
    if (!exportOptions.includeCover) {
      count -= storyBook.pages.filter((p) => p.pageType === "cover").length;
    }
    if (!exportOptions.includeBack) {
      count -= storyBook.pages.filter((p) => p.pageType === "back").length;
    }
    return Math.max(1, count);
  }, [storyBook, exportOptions]);

  const handleExportWithSettings = async () => {
    if (!storyBook || isExporting) return;
    setShowExportSettings(false);
    setIsExporting(true);
    setExportProgress({ current: 0, total: effectivePageCount, stage: "rendering" });
    try {
      await exportBookToPDF(
        storyBook.pages,
        storyBook.title,
        storyBook.language,
        exportOptions,
        (progress) => {
          setExportProgress(progress);
        }
      );
    } catch {
      alert("导出PDF失败，请稍后再试");
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 1000);
    }
  };

  const handleExportClick = () => {
    if (!storyBook || isExporting) return;
    setShowExportSettings(true);
  };

  const updateExportOption = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    setExportOptions((prev) => ({ ...prev, [key]: value }));
  };

  if (!storyBook) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <BookOpen className="w-16 h-16 text-coral/40 mx-auto mb-6" />
          <p className="text-warm-brown/60 text-lg mb-6">还没有绘本哦，去创建一个吧！</p>
          <button
            onClick={() => {
              resetAll();
              navigate("/");
            }}
            className="px-8 py-3 bg-coral text-white font-display rounded-full hover:bg-coral-dark transition-colors"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const page = storyBook.pages[currentPage];
  const totalPages = storyBook.pages.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  return (
    <>
      <GoodNightScreen />
      <div
        className="min-h-screen bg-cream font-body flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden transition-all duration-500"
        style={{
          filter: bedtimeSettings.enabled ? `brightness(${bedtimeSettings.brightness})` : "none",
        }}
      >
        {bedtimeSettings.enabled && (
          <div
            className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-1000"
            style={{
              backgroundColor: bedtimeSettings.lightColor,
              opacity: 0.15 + (1 - bedtimeSettings.brightness) * 0.25,
              mixBlendMode: "multiply",
            }}
          />
        )}

        {starDecorations.map((star, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-twinkle select-none pointer-events-none"
            style={{
              top: star.top,
              left: "left" in star ? star.left : undefined,
              right: "right" in star ? star.right : undefined,
              animationDelay: star.delay,
            }}
          >
            {star.emoji}
          </span>
        ))}

        {bedtimeSettings.enabled && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur rounded-full shadow-lg px-5 py-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: bedtimeSettings.lightColor }}>
                <Moon className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-warm-brown/60" />
                <span className="font-display text-warm-brown text-lg">
                  {formatTime(remainingTime)}
                </span>
              </div>
              <div className="w-px h-6 bg-warm-brown/20" />
              <button
                onClick={handleStopBedtimeMode}
                className="p-1.5 hover:bg-warm-brown/10 rounded-full transition-colors text-warm-brown/60 hover:text-red-500"
                title="退出睡前模式"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

      <div className="relative w-full max-w-3xl">
        <div
          ref={pageRef}
          className="book-shadow rounded-2xl overflow-hidden bg-white/[0.98] aspect-[4/3] relative cursor-crosshair"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={handlePageClick}
        >
          <div key={currentPage} className="animate-fade-in w-full h-full relative">
            {page.pageType === "cover" && (
              <div className="relative w-full h-full">
                <img
                  src={page.illustrationUrl}
                  alt={storyBook.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
                  <h1 className="font-display text-3xl md:text-4xl text-white mb-2 drop-shadow-lg">
                    {storyBook.title}
                  </h1>
                  <p className="text-white/70 text-sm font-body">故事星球出品</p>
                </div>
              </div>
            )}

            {page.pageType === "story" && (
              <div className="w-full h-full flex flex-col">
                <div className="h-[60%] overflow-hidden">
                  <img
                    src={page.illustrationUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="h-[40%] bg-cream/50 px-8 py-6 flex flex-col justify-center relative">
                  <p className="font-body text-lg text-warm-brown text-center leading-relaxed line-clamp-4">
                    {page.text}
                  </p>
                  <span className="absolute bottom-3 right-6 text-sm text-warm-brown/30 font-body">
                    {page.pageNumber}
                  </span>
                </div>
              </div>
            )}

            {page.pageType === "back" && (
              <div className="w-full h-full bg-gradient-to-br from-mint to-mint/70 flex flex-col items-center justify-center relative">
                <span className="absolute top-[15%] left-[10%] text-3xl animate-twinkle">✨</span>
                <span className="absolute top-[20%] right-[12%] text-2xl animate-twinkle" style={{ animationDelay: "1s" }}>⭐</span>
                <span className="absolute bottom-[25%] left-[15%] text-2xl animate-twinkle" style={{ animationDelay: "0.5s" }}>💫</span>
                <span className="absolute bottom-[20%] right-[10%] text-3xl animate-twinkle" style={{ animationDelay: "1.5s" }}>✨</span>
                <p className="font-display text-2xl md:text-3xl text-white text-center px-12 drop-shadow-md max-w-lg">
                  {page.text}
                </p>
              </div>
            )}

            {page.stickers?.map((sticker) => (
              <div
                key={sticker.id}
                className={`absolute cursor-move select-none z-10 transition-transform ${
                  selectedStickerId === sticker.id
                    ? "ring-2 ring-coral ring-offset-2 rounded-lg"
                    : ""
                } ${draggingSticker === sticker.id ? "opacity-80 scale-110" : ""}`}
                style={{
                  left: `${sticker.x}%`,
                  top: `${sticker.y}%`,
                  transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                  fontSize: `${2 * sticker.scale}rem`,
                }}
                onMouseDown={(e) => handleStickerMouseDown(e, sticker)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStickerId(sticker.id);
                }}
              >
                {sticker.emoji}
              </div>
            ))}
          </div>
        </div>

        {!isFirstPage && (
          <button
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 text-warm-brown" />
          </button>
        )}

        {!isLastPage && (
          <button
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors active:scale-95"
          >
            <ChevronRight className="w-6 h-6 text-warm-brown" />
          </button>
        )}
      </div>

      {selectedStickerId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-full shadow-lg px-4 py-2 flex items-center gap-2 z-50 animate-fade-in">
          <button
            onClick={() => handleRotateSticker(selectedStickerId)}
            className="p-2 hover:bg-warm-brown/10 rounded-full transition-colors text-warm-brown"
            title="旋转"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-warm-brown/20" />
          <button
            onClick={() => handleScaleSticker(selectedStickerId, -0.1)}
            className="p-2 hover:bg-warm-brown/10 rounded-full transition-colors text-warm-brown"
            title="缩小"
          >
            <Minus className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleScaleSticker(selectedStickerId, 0.1)}
            className="p-2 hover:bg-warm-brown/10 rounded-full transition-colors text-warm-brown"
            title="放大"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-warm-brown/20" />
          <button
            onClick={() => handleDeleteSticker(selectedStickerId)}
            className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-500"
            title="删除"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetAll();
                navigate("/");
              }}
              className="flex items-center gap-2 text-warm-brown/70 hover:text-warm-brown transition-colors font-body"
            >
              <Home className="w-5 h-5" />
              <span className="text-sm">回到首页</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStickerPanel(!showStickerPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm transition-all ${
                showStickerPanel
                  ? "bg-coral text-white shadow-md"
                  : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
              }`}
            >
              <PaletteIcon className="w-4 h-4" />
              <span>贴纸</span>
            </button>

            {storyBook?.input.coloringModeEnabled && page.lineArtUrl && (
              <button
                onClick={() => navigate(`/coloring?page=${currentPage}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm bg-gradient-to-r from-purple-400 to-pink-400 text-white hover:from-purple-500 hover:to-pink-500 transition-all shadow-md"
                disabled={page.pageType === "back"}
              >
                <PaletteIcon className="w-4 h-4" />
                <span>去涂色</span>
              </button>
            )}
            <button
              onClick={() => navigate(`/puzzle?page=${currentPage}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm bg-gradient-to-r from-purple-400/20 to-pink-400/20 text-warm-brown hover:from-purple-400/30 hover:to-pink-400/30 transition-all"
              disabled={page.pageType === "back"}
            >
              <Puzzle className="w-4 h-4" />
              <span>拼图游戏</span>
            </button>
            <button
              onClick={() => navigate("/match")}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm bg-gradient-to-r from-mint/30 to-sky/30 text-warm-brown hover:from-mint/40 hover:to-sky/40 transition-all"
              disabled={page.pageType === "back"}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>连连看</span>
            </button>
            <button
              onClick={() => setShowBedtimeSettings(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm transition-all ${
                bedtimeSettings.enabled
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                  : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-600 hover:from-indigo-200 hover:to-purple-200"
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>{bedtimeSettings.enabled ? "睡前模式" : "睡前模式"}</span>
            </button>
          </div>

          <span className="text-warm-brown/50 font-body text-sm">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-coral text-white rounded-full font-body text-sm hover:bg-coral-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>导出中...</span>
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                <span>导出PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showStickerPanel && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 z-40 animate-fade-in w-full max-w-md mx-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-warm-brown">选择贴纸</h3>
            <button
              onClick={() => setShowStickerPanel(false)}
              className="p-1 hover:bg-warm-brown/10 rounded-full transition-colors text-warm-brown/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {Object.keys(stickerCategories).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as keyof typeof stickerCategories)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? "bg-coral text-white"
                    : "bg-warm-brown/10 text-warm-brown/70 hover:bg-warm-brown/20"
                }`}
              >
                {cat === "stars" && "星星"}
                {cat === "hearts" && "爱心"}
                {cat === "animals" && "动物"}
                {cat === "flowers" && "花朵"}
                {cat === "food" && "美食"}
                {cat === "others" && "其他"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-2">
            {stickerCategories[activeCategory].map((emoji, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handleStickerDragStart(e, emoji)}
                className="text-2xl p-2 bg-warm-brown/5 rounded-lg cursor-grab hover:bg-warm-brown/10 hover:scale-110 transition-all active:cursor-grabbing"
                title="拖拽到页面上"
              >
                {emoji}
              </div>
            ))}
          </div>
          <p className="text-xs text-warm-brown/50 text-center mt-3 font-body">
            💡 拖拽贴纸到页面上 · 点击已放置的贴纸可旋转、缩放或删除
          </p>
        </div>
      )}

      {showExportSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-coral to-purple-400 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl">导出设置</h2>
                    <p className="text-white/80 text-sm font-body">自定义您的绘本导出选项</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportSettings(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warm-brown">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-display text-lg">纸张设置</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-warm-brown/70 mb-2 font-body">纸张大小</label>
                    <select
                      value={exportOptions.paperSize}
                      onChange={(e) => updateExportOption("paperSize", e.target.value as PaperSize)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/10 bg-cream/50 text-warm-brown font-body focus:outline-none focus:border-coral transition-colors"
                    >
                      {Object.entries(PAPER_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-warm-brown/70 mb-2 font-body">页面方向</label>
                    <select
                      value={exportOptions.orientation}
                      onChange={(e) => updateExportOption("orientation", e.target.value as PageOrientation)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/10 bg-cream/50 text-warm-brown font-body focus:outline-none focus:border-coral transition-colors"
                    >
                      {Object.entries(ORIENTATION_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warm-brown">
                  <Layers className="w-5 h-5" />
                  <h3 className="font-display text-lg">页面内容</h3>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-cream/50 cursor-pointer hover:bg-cream transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-coral/10 rounded-xl flex items-center justify-center">
                        <span className="text-xl">📖</span>
                      </div>
                      <div>
                        <p className="font-body text-warm-brown font-medium">包含封面</p>
                        <p className="text-sm text-warm-brown/60">精美的绘本封面页</p>
                      </div>
                    </div>
                    <div
                      className={`w-12 h-7 rounded-full transition-colors relative ${
                        exportOptions.includeCover ? "bg-coral" : "bg-warm-brown/20"
                      }`}
                      onClick={() => updateExportOption("includeCover", !exportOptions.includeCover)}
                    >
                      <div
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          exportOptions.includeCover ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-4 rounded-xl bg-cream/50 cursor-pointer hover:bg-cream transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-mint/20 rounded-xl flex items-center justify-center">
                        <span className="text-xl">💝</span>
                      </div>
                      <div>
                        <p className="font-body text-warm-brown font-medium">包含封底</p>
                        <p className="text-sm text-warm-brown/60">温暖的故事结尾页</p>
                      </div>
                    </div>
                    <div
                      className={`w-12 h-7 rounded-full transition-colors relative ${
                        exportOptions.includeBack ? "bg-coral" : "bg-warm-brown/20"
                      }`}
                      onClick={() => updateExportOption("includeBack", !exportOptions.includeBack)}
                    >
                      <div
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          exportOptions.includeBack ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warm-brown">
                  <Image className="w-5 h-5" />
                  <h3 className="font-display text-lg">图片质量</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(QUALITY_SETTINGS) as ImageQuality[]).map((quality) => (
                    <button
                      key={quality}
                      onClick={() => updateExportOption("imageQuality", quality)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        exportOptions.imageQuality === quality
                          ? "bg-coral text-white shadow-lg scale-[1.02]"
                          : "bg-cream/50 text-warm-brown hover:bg-cream"
                      }`}
                    >
                      <p className="font-display font-medium">{QUALITY_SETTINGS[quality].label}</p>
                      <p className={`text-xs mt-1 ${
                        exportOptions.imageQuality === quality ? "text-white/80" : "text-warm-brown/60"
                      }`}>
                        {QUALITY_SETTINGS[quality].scale}x 分辨率
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-body text-warm-brown/70 text-sm">预估文件大小</span>
                  <span className="font-display text-2xl text-purple-600">
                    {formatFileSize(estimatedFileSize)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-brown/60 font-body">
                    共 {effectivePageCount} 页
                  </span>
                  <span className="text-warm-brown/40 font-body">
                    {PAPER_LABELS[exportOptions.paperSize]} · {ORIENTATION_LABELS[exportOptions.orientation]} · {QUALITY_SETTINGS[exportOptions.imageQuality].label}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-warm-brown/5 border-t border-warm-brown/10">
              <button
                onClick={handleExportWithSettings}
                className="w-full py-4 bg-gradient-to-r from-coral to-purple-500 text-white rounded-2xl font-display text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" />
                开始导出 PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {isExporting && exportProgress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#FFE4E1"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(exportProgress.current / exportProgress.total) * 251.2} 251.2`}
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF6B6B" />
                    <stop offset="100%" stopColor="#C4A8FF" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-2xl text-warm-brown">
                  {Math.round((exportProgress.current / exportProgress.total) * 100)}%
                </span>
              </div>
            </div>
            <h3 className="font-display text-2xl text-warm-brown mb-2">
              {exportProgress.stage === "rendering" && "正在渲染页面..."}
              {exportProgress.stage === "compiling" && "正在生成 PDF..."}
              {exportProgress.stage === "complete" && "导出完成！"}
            </h3>
            <p className="font-body text-warm-brown/60 mb-4">
              第 {exportProgress.current} 页 / 共 {exportProgress.total} 页
            </p>
            <div className="flex justify-center gap-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 bg-coral rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <BedtimeSettings
        isOpen={showBedtimeSettings}
        onClose={() => setShowBedtimeSettings(false)}
      />
    </div>
    </>
  );
}
