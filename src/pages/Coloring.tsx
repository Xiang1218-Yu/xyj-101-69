import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Palette, Undo2, Redo2, Trash2, Save, ChevronLeft, ChevronRight, Eye, EyeOff, Download, X, Check, Eraser, Minus, Plus, PaintBucket } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { ColoringArtwork } from "@/store/useStore";

/* 36色调色板 */
const colorPalette = [
  "#FF6B6B", "#FF8E8E", "#FFB4B4", "#FFD4D4",
  "#FF9F43", "#FFB975", "#FFD3A7", "#FFEDD9",
  "#FECA57", "#FFD97D", "#FFE8A3", "#FFF7C9",
  "#48DBFB", "#73E3FF", "#9EEBFF", "#C9F3FF",
  "#1DD1A1", "#4DDDB5", "#7DE9C9", "#ADF5DD",
  "#5F27CD", "#7F4CD7", "#9F71E1", "#BF96EB",
  "#FF6B9D", "#FF8FB3", "#FFB3C9", "#FFD7DF",
  "#2D3436", "#636E72", "#B2BEC3", "#DFE6E9",
  "#FFFFFF", "#F8F9FA", "#E9ECEF", "#DEE2E6",
];

/* 7种笔刷大小 */
const brushSizes = [4, 8, 12, 16, 24, 32, 48];

export default function Coloring() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storyBook, addColoringArtwork, resetAll } = useStore();

  /* 双Canvas架构：涂色层（用户交互）+ 线稿层（只读叠加显示） */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineArtCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get("page");
    return page ? parseInt(page, 10) : 0;
  });
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");
  const [brushSize, setBrushSize] = useState(8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isEraser, setIsEraser] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* 填充模式：开启后点击直接触发区域填充，方便移动端使用 */
  const [isFillMode, setIsFillMode] = useState(false);

  /* 画布尺寸状态，根据线稿图片自然尺寸动态设置 */
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const storyPages = storyBook?.pages.filter(p => p.pageType !== "back") || [];
  const page = storyPages[currentPage];
  const totalPages = storyPages.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  /**
   * 初始化画布
   * 改进：使用线稿图片的自然尺寸设置画布，避免拉伸变形
   * 线稿层加载线稿图片，涂色层填充白色背景
   */
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !lineArtCanvasRef.current || !page) return;

    const canvas = canvasRef.current;
    const lineArtCanvas = lineArtCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const lineArtCtx = lineArtCanvas.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    /* 先加载线稿图片，获取其自然尺寸 */
    const lineArtImg = new Image();
    lineArtImg.crossOrigin = "anonymous";

    lineArtImg.onload = () => {
      /* 使用线稿图片的自然尺寸，确保涂色区域与原图完全一致 */
      const width = lineArtImg.naturalWidth || 800;
      const height = lineArtImg.naturalHeight || 600;

      canvas.width = width;
      canvas.height = height;
      lineArtCanvas.width = width;
      lineArtCanvas.height = height;
      setCanvasSize({ width, height });

      /* 涂色层填充白色背景 */
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      /* 线稿层绘制线稿图片，保持原始尺寸不拉伸 */
      lineArtCtx.drawImage(lineArtImg, 0, 0, width, height);

      /* 保存初始状态到历史记录 */
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL();
        setHistory([dataUrl]);
        setHistoryIndex(0);
      }
    };

    /* 优先使用线稿URL，无则回退到插图URL */
    lineArtImg.src = page.lineArtUrl || page.illustrationUrl;
  }, [page]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas, currentPage]);

  /* 保存当前画布状态到历史记录（用于撤销/重做） */
  const saveState = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex <= 0 || !canvasRef.current) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = history[newIndex];
  };

  const redo = () => {
    if (historyIndex >= history.length - 1 || !canvasRef.current) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = history[newIndex];
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveState();
  };

  /**
   * 获取画布坐标
   * 将鼠标/触摸的屏幕坐标转换为画布内部坐标
   * 考虑CSS缩放带来的坐标偏移
   */
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  /**
   * 自由绘画
   * 改进：橡皮擦改为涂白色而非 destination-out
   * destination-out 会产生透明像素，干扰洪水填充的颜色匹配
   * 涂白色则保持画布始终不透明，填充功能正常工作
   */
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    /* 橡皮擦涂白色，画笔涂选中颜色 */
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = isEraser ? "#FFFFFF" : selectedColor;
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  /**
   * 洪水填充算法（区域填色）
   *
   * 改进：
   * 1. 使用 Uint8Array 替代 Set<string> 标记已访问像素，性能大幅提升
   * 2. 线稿边界检测：RGB任一通道 < 150 视为线稿边界（黑色线条）
   * 3. 目标颜色容差匹配：允许10的误差，处理抗锯齿边缘
   * 4. 支持填充模式和Shift+点击两种触发方式
   */
  const floodFill = (startX: number, startY: number) => {
    if (!canvasRef.current || !lineArtCanvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const lineArtCtx = lineArtCanvasRef.current.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    const x = Math.floor(startX);
    const y = Math.floor(startY);

    /* 边界检查 */
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const lineArtData = lineArtCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const lineData = lineArtData.data;

    /* 获取点击位置的目标颜色 */
    const targetR = data[(y * width + x) * 4];
    const targetG = data[(y * width + x) * 4 + 1];
    const targetB = data[(y * width + x) * 4 + 2];

    const fillColor = hexToRgb(selectedColor);
    if (!fillColor) return;

    /* 如果目标颜色和填充颜色相同，无需操作 */
    if (targetR === fillColor.r && targetG === fillColor.g && targetB === fillColor.b) {
      return;
    }

    /* 判断是否为线稿像素（黑色线条） */
    const isLinePixel = (idx: number) => {
      return lineData[idx] < 150 || lineData[idx + 1] < 150 || lineData[idx + 2] < 150;
    };

    /* 判断是否匹配目标颜色（容差10，处理抗锯齿边缘） */
    const matchesTarget = (idx: number) => {
      return Math.abs(data[idx] - targetR) < 10 &&
             Math.abs(data[idx + 1] - targetG) < 10 &&
             Math.abs(data[idx + 2] - targetB) < 10;
    };

    /* 使用 Uint8Array 标记已访问像素，比 Set<string> 性能更好 */
    const visited = new Uint8Array(width * height);

    /* 使用数组模拟栈，避免递归栈溢出 */
    const stack: number[] = [y * width + x];

    while (stack.length > 0) {
      const pos = stack.pop()!;
      const px = pos % width;
      const py = Math.floor(pos / width);

      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (visited[pos]) continue;

      const idx = pos * 4;

      /* 遇到线稿边界停止填充 */
      if (isLinePixel(idx)) continue;
      /* 颜色不匹配目标则停止（已填充过其他颜色） */
      if (!matchesTarget(idx)) continue;

      visited[pos] = 1;

      /* 填充颜色 */
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = 255;

      /* 向四个方向扩展 */
      stack.push(pos + 1);
      stack.push(pos - 1);
      stack.push(pos + width);
      stack.push(pos - width);
    }

    ctx.putImageData(imageData, 0, 0);
    saveState();
  };

  /**
   * 处理鼠标点击事件
   * 填充模式下直接触发洪水填充，否则按住Shift触发
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFillMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !canvasRef.current) return;
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      floodFill(x, y);
    } else if (e.shiftKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !canvasRef.current) return;
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      floodFill(x, y);
    } else {
      startDrawing(e);
    }
  };

  /**
   * 处理触摸点击事件
   * 填充模式下触发洪水填充，否则开始绘画
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFillMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !canvasRef.current) return;
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = (e.touches[0].clientX - rect.left) * scaleX;
      const y = (e.touches[0].clientY - rect.top) * scaleY;
      floodFill(x, y);
    } else {
      startDrawing(e);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  };

  /**
   * 保存涂色作品
   * 合成涂色层 + 线稿层，存入Store
   */
  const saveArtwork = () => {
    if (!canvasRef.current || !page) return;

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = canvasSize.width;
    compositeCanvas.height = canvasSize.height;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    compositeCtx.drawImage(canvasRef.current, 0, 0);
    compositeCtx.drawImage(lineArtCanvasRef.current!, 0, 0);

    const imageDataUrl = compositeCanvas.toDataURL("image/png");

    const artwork: ColoringArtwork = {
      id: `artwork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pageIndex: currentPage,
      imageDataUrl,
      createdAt: new Date().toISOString(),
    };

    addColoringArtwork(currentPage, artwork);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  /**
   * 下载涂色作品
   * 合成涂色层 + 线稿层，导出为PNG
   */
  const downloadArtwork = () => {
    if (!canvasRef.current) return;

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = canvasSize.width;
    compositeCanvas.height = canvasSize.height;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    compositeCtx.drawImage(canvasRef.current, 0, 0);
    compositeCtx.drawImage(lineArtCanvasRef.current!, 0, 0);

    const link = document.createElement("a");
    link.download = `涂色作品_${page?.pageNumber || currentPage + 1}.png`;
    link.href = compositeCanvas.toDataURL("image/png");
    link.click();
  };

  const loadArtwork = (artwork: ColoringArtwork) => {
    if (!canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        ctx.drawImage(img, 0, 0);
        saveState();
      }
    };
    img.src = artwork.imageDataUrl;
    setShowGallery(false);
  };

  if (!storyBook) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Palette className="w-16 h-16 text-coral/40 mx-auto mb-6" />
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

  const artworks = page?.coloringArtworks || [];

  /* 动态计算画布容器的宽高比，确保与线稿图片一致 */
  const canvasAspectRatio = canvasSize.width / canvasSize.height;

  return (
    <div className="min-h-screen bg-cream font-body flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-4xl mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/book")}
            className="flex items-center gap-2 text-warm-brown/70 hover:text-warm-brown transition-colors font-body"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">返回绘本</span>
          </button>
          <h1 className="font-display text-2xl text-warm-brown">🎨 涂色乐园</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="relative w-full max-w-4xl mb-4">
        {/* 画布容器：宽高比根据线稿图片动态设置 */}
        <div
          className="book-shadow rounded-2xl overflow-hidden bg-white relative"
          style={{ aspectRatio: `${canvasAspectRatio}` }}
        >
          {/* 涂色层：用户交互的Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {/* 线稿层：只读叠加显示，使用multiply混合模式 */}
          <canvas
            ref={lineArtCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: "multiply" }}
          />
          {/* 原图叠加层：半透明显示原图作为参考 */}
          {showOriginal && page && (
            <img
              src={page.illustrationUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50"
            />
          )}

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

        <div className="mt-2 text-center">
          <span className="text-warm-brown/50 font-body text-sm">
            第 {currentPage + 1} 页 / 共 {totalPages} 页 · {isFillMode ? "填充模式：点击区域填色" : "绘画模式：按住拖动涂色，Shift+点击区域填充"}
          </span>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 撤销/重做/清空 */}
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-2 rounded-xl bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="撤销"
              >
                <Undo2 className="w-5 h-5" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 rounded-xl bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="重做"
              >
                <Redo2 className="w-5 h-5" />
              </button>
              <button
                onClick={clearCanvas}
                className="p-2 rounded-xl bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                title="清空"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* 橡皮擦/填充模式/显示原图 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEraser(!isEraser);
                  setIsFillMode(false);
                }}
                className={`p-2 rounded-xl transition-colors ${
                  isEraser
                    ? "bg-coral text-white shadow-md"
                    : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
                }`}
                title="橡皮擦"
              >
                <Eraser className="w-5 h-5" />
              </button>
              {/* 填充模式按钮：点击切换，方便移动端使用区域填充 */}
              <button
                onClick={() => {
                  setIsFillMode(!isFillMode);
                  setIsEraser(false);
                }}
                className={`p-2 rounded-xl transition-colors ${
                  isFillMode
                    ? "bg-coral text-white shadow-md"
                    : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
                }`}
                title="填充模式"
              >
                <PaintBucket className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className={`p-2 rounded-xl transition-colors ${
                  showOriginal
                    ? "bg-coral text-white shadow-md"
                    : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
                }`}
                title="显示原图"
              >
                {showOriginal ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* 笔刷大小 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBrushSize(Math.max(4, brushSize - 4))}
                disabled={brushSize <= 4}
                className="p-1 rounded-lg bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors disabled:opacity-30"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {brushSizes.slice(0, 5).map((size) => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={`rounded-full transition-all ${
                      brushSize === size
                        ? "bg-coral ring-2 ring-coral/30"
                        : "bg-warm-brown/20 hover:bg-warm-brown/30"
                    }`}
                    style={{ width: size + 8, height: size + 8 }}
                  />
                ))}
              </div>
              <button
                onClick={() => setBrushSize(Math.min(48, brushSize + 4))}
                disabled={brushSize >= 48}
                className="p-1 rounded-lg bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20 transition-colors disabled:opacity-30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 调色板 */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: selectedColor }}
              />
              <div className="grid grid-cols-10 gap-1">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setIsEraser(false);
                    }}
                    className={`w-6 h-6 rounded transition-all ${
                      selectedColor === color && !isEraser
                        ? "ring-2 ring-coral ring-offset-1 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color, border: color === "#FFFFFF" ? "1px solid #ddd" : "none" }}
                  />
                ))}
              </div>
            </div>

            {/* 保存/下载/作品库 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl font-body text-sm transition-all ${
                  showGallery
                    ? "bg-purple-500 text-white shadow-md"
                    : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>作品库 ({artworks.length})</span>
              </button>
              <button
                onClick={saveArtwork}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-coral text-white font-body text-sm hover:bg-coral-dark transition-colors shadow-md"
              >
                {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saveSuccess ? "已保存" : "保存"}</span>
              </button>
              <button
                onClick={downloadArtwork}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-mint to-teal-500 text-white font-body text-sm hover:from-teal-500 hover:to-mint transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>下载</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 作品库弹窗 */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Palette className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl">我的涂色作品</h2>
                    <p className="text-white/80 text-sm font-body">第 {currentPage + 1} 页的作品</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGallery(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {artworks.length === 0 ? (
                <div className="text-center py-12">
                  <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-warm-brown/60 font-body">还没有保存的作品哦，快去涂色吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                  {artworks.slice().reverse().map((artwork) => (
                    <div
                      key={artwork.id}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-md cursor-pointer hover:shadow-xl transition-all"
                      onClick={() => loadArtwork(artwork)}
                    >
                      <img
                        src={artwork.imageDataUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 font-display">
                          点击加载
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-xs text-warm-brown/60">
                        {new Date(artwork.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-display animate-bounce z-50">
          ✨ 作品保存成功！
        </div>
      )}
    </div>
  );
}
