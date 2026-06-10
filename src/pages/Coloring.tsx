/**
 * ============================================================================
 * 涂色页面 (Coloring Page)
 * ============================================================================
 *
 * 功能说明：
 * - 展示线稿涂色页，支持自由画笔涂色和区域泛洪填充
 * - 双层Canvas架构：底层为涂色层（用户绘制），顶层为线稿层（固定轮廓）
 * - 线稿层使用 mixBlendMode: multiply 叠加，保证黑色线条始终可见
 * - 支持撤销/重做、橡皮擦、调色板、画笔大小调节、保存/下载作品
 *
 * 涂色区域保证与原页面一模一样的原理：
 * - 线稿层(lineArtCanvas)精确绘制从原图提取的轮廓线，构成封闭涂色区域
 * - 泛洪填充(floodFill)以线稿层的深色像素为边界，不会越出轮廓
 * - 画笔层(canvas)在下层，颜色被线稿层的黑色线条覆盖而不影响轮廓
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Palette, Undo2, Redo2, Trash2, Save, ChevronLeft, ChevronRight, Eye, EyeOff, Download, X, Check, Eraser, Minus, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { ColoringArtwork } from "@/store/useStore";

/** 调色板颜色配置：每行4组渐变色，共9行36色 */
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

/** 画笔尺寸选项（像素直径） */
const brushSizes = [4, 8, 12, 16, 24, 32, 48];

/** 画布固定尺寸 - 与插画/线稿生成尺寸一致 */
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

/**
 * 判断像素是否为线稿边界像素
 * 线稿为白底(255)黑线(0)，考虑到SVG渲染的半透明描边和抗锯齿像素，
 * 阈值设为200：只要任一通道小于200即认为是线条（边界），有效防止flood fill泄漏
 */
const LINE_PIXEL_THRESHOLD = 200;

/** 颜色匹配容差：判断两个颜色是否"相同"（用于flood fill的目标色匹配） */
const COLOR_MATCH_TOLERANCE = 15;

export default function Coloring() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storyBook, addColoringArtwork, resetAll } = useStore();

  /** 涂色层Canvas引用（用户绘制颜色的层） */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** 线稿层Canvas引用（固定黑色轮廓，叠加在涂色层之上） */
  const lineArtCanvasRef = useRef<HTMLCanvasElement>(null);

  /** 当前页码 */
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

  /** 过滤掉封底页，只保留封面和故事页用于涂色 */
  const storyPages = storyBook?.pages.filter(p => p.pageType !== "back") || [];
  const page = storyPages[currentPage];
  const totalPages = storyPages.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  /**
   * 初始化双Canvas：设置尺寸、白底、加载线稿
   * 每次切换页面时重新初始化
   */
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !lineArtCanvasRef.current || !page) return;

    const canvas = canvasRef.current;
    const lineArtCanvas = lineArtCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const lineArtCtx = lineArtCanvas.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    // 设置固定画布尺寸
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    lineArtCanvas.width = CANVAS_WIDTH;
    lineArtCanvas.height = CANVAS_HEIGHT;

    // 涂色层初始化为纯白背景
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 加载线稿图片并绘制到线稿层
    const lineArtImg = new Image();
    lineArtImg.crossOrigin = "anonymous";
    lineArtImg.onload = () => {
      // 清空线稿层并重绘（白底+黑线）
      lineArtCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      lineArtCtx.drawImage(lineArtImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // 保存初始状态到历史记录
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL();
        setHistory([dataUrl]);
        setHistoryIndex(0);
      }
    };
    // 优先使用提取的线稿URL，若不存在则回退到原插画URL
    lineArtImg.src = page.lineArtUrl || page.illustrationUrl;
  }, [page]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas, currentPage]);

  /**
   * 保存当前涂色层状态到历史记录（用于撤销/重做）
   * 最多保留50步历史
   */
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

  /** 撤销：回到上一步状态 */
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

  /** 重做：前进到下一步状态 */
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

  /** 清空涂色层（恢复纯白） */
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveState();
  };

  /**
   * 获取鼠标/触摸事件在Canvas上的精确坐标
   * 考虑了Canvas的CSS缩放比例，将屏幕坐标转换为画布像素坐标
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
   * 画笔绘制：在涂色层画圆点
   * 橡皮擦模式使用 destination-out 擦除像素
   */
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    if (isEraser) {
      // 橡皮擦：使用白色圆形覆盖（而非destination-out），保证导出时背景为白色
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#FFFFFF";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = selectedColor;
    }
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
   * Hex颜色转RGB对象
   */
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  };

  /**
   * 泛洪填充（Flood Fill）算法
   *
   * 原理：从点击位置开始，使用栈式迭代填充所有连通的同色区域，
   *       以线稿层的深色像素为边界（不会越过黑色轮廓线）。
   *
   * 边界检测：检查线稿层像素，任一RGB通道 < LINE_PIXEL_THRESHOLD(200) 即视为不可越过的边界
   * 颜色匹配：使用容差(COLOR_MATCH_TOLERANCE=15)判断两个颜色是否"相同"，抵抗抗锯齿噪点
   */
  const floodFill = (e: React.MouseEvent) => {
    if (!canvasRef.current || !lineArtCanvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const lineArtCtx = lineArtCanvasRef.current.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 读取涂色层像素数据（将被修改）
    const imageData = ctx.getImageData(0, 0, width, height);
    // 读取线稿层像素数据（只读，用于边界检测）
    const lineArtData = lineArtCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const lineData = lineArtData.data;

    // 获取点击位置的目标颜色（将被替换的颜色）
    const targetIdx = (y * width + x) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];

    const fillColor = hexToRgb(selectedColor);
    if (!fillColor) return;

    // 如果点击区域已经是目标颜色，不做任何操作
    if (Math.abs(targetR - fillColor.r) < COLOR_MATCH_TOLERANCE &&
        Math.abs(targetG - fillColor.g) < COLOR_MATCH_TOLERANCE &&
        Math.abs(targetB - fillColor.b) < COLOR_MATCH_TOLERANCE) {
      return;
    }

    /**
     * 判断像素是否为线稿边界（黑色轮廓线）
     * 检查线稿层：任一RGB通道低于阈值(200)即为线条
     * 阈值较高(200)可以捕获SVG半透明描边和抗锯齿灰色像素，有效防止flood fill泄漏
     */
    const isLinePixel = (pixelIdx: number): boolean => {
      return (
        lineData[pixelIdx] < LINE_PIXEL_THRESHOLD ||
        lineData[pixelIdx + 1] < LINE_PIXEL_THRESHOLD ||
        lineData[pixelIdx + 2] < LINE_PIXEL_THRESHOLD
      );
    };

    /**
     * 判断像素颜色是否匹配填充目标色（带容差）
     * 容差处理抗锯齿边缘的微小颜色差异
     */
    const matchesTarget = (pixelIdx: number): boolean => {
      return (
        Math.abs(data[pixelIdx] - targetR) <= COLOR_MATCH_TOLERANCE &&
        Math.abs(data[pixelIdx + 1] - targetG) <= COLOR_MATCH_TOLERANCE &&
        Math.abs(data[pixelIdx + 2] - targetB) <= COLOR_MATCH_TOLERANCE
      );
    };

    // 栈式泛洪填充（4邻域：上下左右）
    const stack: Array<[number, number]> = [[x, y]];
    // 使用Uint8Array作为visited标记（比Set快得多，适合大画布）
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;

      // 越界检查
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
      const pixelKey = cy * width + cx;
      // 已访问检查
      if (visited[pixelKey]) continue;

      const pixelIdx = pixelKey * 4;

      // 线稿边界检查：不越过轮廓线
      if (isLinePixel(pixelIdx)) continue;
      // 颜色匹配检查：只填充连通的同色区域
      if (!matchesTarget(pixelIdx)) continue;

      visited[pixelKey] = 1;

      // 写入填充颜色
      data[pixelIdx] = fillColor.r;
      data[pixelIdx + 1] = fillColor.g;
      data[pixelIdx + 2] = fillColor.b;
      data[pixelIdx + 3] = 255;

      // 4邻域扩展
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    saveState();
  };

  /**
   * 保存作品到本地画廊
   * 合并涂色层和线稿层导出为PNG
   */
  const saveArtwork = () => {
    if (!canvasRef.current || !page) return;

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = CANVAS_WIDTH;
    compositeCanvas.height = CANVAS_HEIGHT;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    // 先画涂色层（白底+颜色），再画线稿层（黑色轮廓叠加）
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
   * 下载作品为PNG图片到本地
   */
  const downloadArtwork = () => {
    if (!canvasRef.current) return;

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = CANVAS_WIDTH;
    compositeCanvas.height = CANVAS_HEIGHT;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    compositeCtx.drawImage(canvasRef.current, 0, 0);
    compositeCtx.drawImage(lineArtCanvasRef.current!, 0, 0);

    const link = document.createElement("a");
    link.download = `涂色作品_${page?.pageNumber || currentPage + 1}.png`;
    link.href = compositeCanvas.toDataURL("image/png");
    link.click();
  };

  /**
   * 从作品库加载已保存的作品到涂色层
   */
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

  // 无绘本数据时显示空状态提示
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

  return (
    <div className="min-h-screen bg-cream font-body flex flex-col items-center px-4 py-6">
      {/* 顶部导航栏 */}
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

      {/* 画布区域 */}
      <div className="relative w-full max-w-4xl mb-4">
        <div className="book-shadow rounded-2xl overflow-hidden bg-white aspect-[4/3] relative">
          {/* 底层：涂色层Canvas - 用户绘制的颜色 */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onMouseDown={(e) => e.shiftKey ? floodFill(e) : startDrawing(e)}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {/* 顶层：线稿层Canvas - 固定黑色轮廓，使用multiply混合模式叠加
              multiply模式：白色(255)完全透明，黑色(0)完全不显示底层，实现线稿覆盖效果 */}
          <canvas
            ref={lineArtCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: "multiply" }}
          />
          {/* 原图对比叠加层（半透明显示在最上面） */}
          {showOriginal && page && (
            <img
              src={page.illustrationUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50"
            />
          )}

          {/* 翻页按钮 */}
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
            第 {currentPage + 1} 页 / 共 {totalPages} 页 · 按住拖动涂色，Shift+点击区域填充
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

            {/* 橡皮擦/显示原图 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEraser(!isEraser)}
                className={`p-2 rounded-xl transition-colors ${
                  isEraser
                    ? "bg-coral text-white shadow-md"
                    : "bg-warm-brown/10 text-warm-brown hover:bg-warm-brown/20"
                }`}
                title="橡皮擦"
              >
                <Eraser className="w-5 h-5" />
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

            {/* 画笔大小调节 */}
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

            {/* 颜色选择器 */}
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

            {/* 作品库/保存/下载 */}
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

      {/* 保存成功提示 */}
      {saveSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-display animate-bounce z-50">
          ✨ 作品保存成功！
        </div>
      )}
    </div>
  );
}
