/**
 * 涂色页面组件
 * 提供完整的涂色功能，包括画笔、橡皮、填充、撤销重做等
 * 确保涂色区域与原页面元素位置完全一致
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Palette, Undo2, Redo2, Trash2, Save, ChevronLeft, ChevronRight, Eye, EyeOff, Download, X, Check, Eraser, Minus, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { ColoringArtwork } from "@/store/useStore";

// 调色板 - 36种颜色，包含冷暖色调和中性色
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

// 画笔大小选项
const brushSizes = [4, 8, 12, 16, 24, 32, 48];

// 画布标准尺寸
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function Coloring() {
  // 路由和状态
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storyBook, addColoringArtwork, resetAll } = useStore();

  // 画布引用 - 涂色层和线稿层分离
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineArtCanvasRef = useRef<HTMLCanvasElement>(null);

  // 当前页码
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get("page");
    return page ? parseInt(page, 10) : 0;
  });

  // 涂色工具状态
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");
  const [brushSize, setBrushSize] = useState(8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 历史记录 - 用于撤销重做
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 过滤掉封底页，只显示有涂色价值的页面
  const storyPages = storyBook?.pages.filter(p => p.pageType !== "back") || [];
  const page = storyPages[currentPage];
  const totalPages = storyPages.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  /**
   * 初始化画布
   * 确保线稿和涂色层精确对齐，尺寸完全一致
   */
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !lineArtCanvasRef.current || !page) return;

    const canvas = canvasRef.current;
    const lineArtCanvas = lineArtCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const lineArtCtx = lineArtCanvas.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    // 设置画布为标准尺寸，确保比例一致
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    lineArtCanvas.width = CANVAS_WIDTH;
    lineArtCanvas.height = CANVAS_HEIGHT;

    // 填充白色背景
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 加载线稿图 - 使用 lineArtUrl，确保与原图元素位置一致
    const lineArtImg = new Image();
    lineArtImg.crossOrigin = "anonymous";
    
    lineArtImg.onload = () => {
      // 使用 contain 模式确保图像完整显示且不变形
      const { dx, dy, dw, dh } = calculateContainDimensions(
        lineArtImg.width,
        lineArtImg.height,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
      
      // 清除线稿画布
      lineArtCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // 绘制线稿，保持比例居中
      lineArtCtx.drawImage(lineArtImg, dx, dy, dw, dh);
      
      // 保存初始状态到历史记录
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL();
        setHistory([dataUrl]);
        setHistoryIndex(0);
      }
    };

    // 如果没有线稿URL，使用原图作为后备（但这会导致涂色效果不好）
    lineArtImg.src = page.lineArtUrl || page.illustrationUrl;
  }, [page]);

  /**
   * 计算 contain 模式下的图像尺寸和位置
   * 确保图像完整显示在画布内，保持原比例
   * @param imgWidth 原图宽度
   * @param imgHeight 原图高度
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @returns 绘制位置和尺寸
   */
  const calculateContainDimensions = (
    imgWidth: number,
    imgHeight: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let dw: number, dh: number;
    
    if (imgRatio > canvasRatio) {
      // 图片更宽，以宽度为准
      dw = canvasWidth;
      dh = canvasWidth / imgRatio;
    } else {
      // 图片更高，以高度为准
      dh = canvasHeight;
      dw = canvasHeight * imgRatio;
    }

    // 居中显示
    const dx = (canvasWidth - dw) / 2;
    const dy = (canvasHeight - dh) / 2;

    return { dx, dy, dw, dh };
  };

  // 页面切换时重新初始化画布
  useEffect(() => {
    initCanvas();
  }, [initCanvas, currentPage]);

  /**
   * 保存当前状态到历史记录
   * 用于撤销重做功能
   */
  const saveState = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setHistory(prev => {
      // 删除当前位置之后的历史（重做栈）
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      // 限制历史记录最多50步
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  /**
   * 撤销操作
   * 回到上一步的状态
   */
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

  /**
   * 重做操作
   * 前进到下一步的状态
   */
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

  /**
   * 清空画布
   * 恢复到初始的白色背景状态
   */
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
   * 将鼠标/触摸事件的屏幕坐标转换为画布内部坐标
   * @param e 鼠标或触摸事件
   * @returns 画布上的坐标 {x, y}
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
   * 绘制函数
   * 使用圆形画笔进行绘制，支持橡皮擦功能
   * @param e 鼠标或触摸事件
   */
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    // 设置合成模式：橡皮擦使用 destination-out 擦除，普通画笔使用 source-over 覆盖
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    ctx.fillStyle = isEraser ? "rgba(255,255,255,1)" : selectedColor;
    
    // 绘制圆形画笔
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  /**
   * 开始绘制
   * @param e 鼠标或触摸事件
   */
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  /**
   * 停止绘制
   * 保存当前状态到历史记录
   */
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  /**
   * 洪水填充算法
   * Shift+点击时触发，填充封闭区域
   * 使用线稿作为边界，确保不会涂出边界
   * @param e 鼠标点击事件
   */
  const floodFill = (e: React.MouseEvent) => {
    if (!canvasRef.current || !lineArtCanvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const lineArtCtx = lineArtCanvasRef.current.getContext("2d");
    if (!ctx || !lineArtCtx) return;

    // 获取点击位置的画布坐标
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 获取涂色层和线稿层的像素数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const lineArtData = lineArtCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const lineData = lineArtData.data;

    // 获取目标像素的颜色（需要填充的区域颜色）
    const targetR = data[(y * width + x) * 4];
    const targetG = data[(y * width + x) * 4 + 1];
    const targetB = data[(y * width + x) * 4 + 2];

    // 将选中的颜色转换为RGB
    const fillColor = hexToRgb(selectedColor);
    if (!fillColor) return;

    // 如果目标颜色已经是填充颜色，直接返回
    if (targetR === fillColor.r && targetG === fillColor.g && targetB === fillColor.b) {
      return;
    }

    /**
     * 判断是否是线稿像素
     * 使用灰度阈值判断，线稿像素为深色
     * @param idx 像素索引
     * @returns 是否是线稿像素
     */
    const isLinePixel = (idx: number) => {
      // 计算灰度值
      const gray = 0.299 * lineData[idx] + 0.587 * lineData[idx + 1] + 0.114 * lineData[idx + 2];
      // 灰度值小于180认为是线稿（阈值比之前更宽松，确保捕获更多边缘）
      return gray < 180;
    };

    /**
     * 判断像素是否匹配目标颜色
     * 使用容差判断，允许一定的颜色差异
     * @param idx 像素索引
     * @returns 是否匹配
     */
    const matchesTarget = (idx: number) => {
      const tolerance = 15; // 颜色容差
      return Math.abs(data[idx] - targetR) < tolerance &&
             Math.abs(data[idx + 1] - targetG) < tolerance &&
             Math.abs(data[idx + 2] - targetB) < tolerance;
    };

    // 使用栈实现洪水填充，避免递归深度问题
    const stack: [number, number][] = [[x, y]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      const key = `${cx},${cy}`;

      // 边界检查
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
      // 已访问检查
      if (visited.has(key)) continue;

      const idx = (cy * width + cx) * 4;

      // 遇到线稿边界，停止填充
      if (isLinePixel(idx)) continue;
      // 不匹配目标颜色，停止填充
      if (!matchesTarget(idx)) continue;

      // 标记为已访问
      visited.add(key);

      // 填充颜色
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = 255;

      // 将四个方向的像素加入栈
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    // 将填充结果写回画布
    ctx.putImageData(imageData, 0, 0);
    saveState();
  };

  /**
   * 十六进制颜色转RGB
   * @param hex 十六进制颜色字符串
   * @returns RGB颜色对象
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
   * 保存涂色作品
   * 将涂色层和线稿层合成后保存到store
   */
  const saveArtwork = () => {
    if (!canvasRef.current || !page) return;

    // 创建合成画布
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = CANVAS_WIDTH;
    compositeCanvas.height = CANVAS_HEIGHT;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    // 先绘制涂色层，再绘制线稿层（线稿在上）
    compositeCtx.drawImage(canvasRef.current, 0, 0);
    compositeCtx.drawImage(lineArtCanvasRef.current!, 0, 0);

    // 转换为图片DataURL
    const imageDataUrl = compositeCanvas.toDataURL("image/png");

    // 创建作品对象
    const artwork: ColoringArtwork = {
      id: `artwork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pageIndex: currentPage,
      imageDataUrl,
      createdAt: new Date().toISOString(),
    };

    // 保存到store
    addColoringArtwork(currentPage, artwork);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  /**
   * 下载涂色作品
   * 将合成后的图片下载到本地
   */
  const downloadArtwork = () => {
    if (!canvasRef.current) return;

    // 创建合成画布
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = CANVAS_WIDTH;
    compositeCanvas.height = CANVAS_HEIGHT;
    const compositeCtx = compositeCanvas.getContext("2d");
    if (!compositeCtx) return;

    // 先绘制涂色层，再绘制线稿层
    compositeCtx.drawImage(canvasRef.current, 0, 0);
    compositeCtx.drawImage(lineArtCanvasRef.current!, 0, 0);

    // 创建下载链接
    const link = document.createElement("a");
    link.download = `涂色作品_${page?.pageNumber || currentPage + 1}.png`;
    link.href = compositeCanvas.toDataURL("image/png");
    link.click();
  };

  /**
   * 加载已保存的涂色作品
   * @param artwork 涂色作品对象
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

  // 如果没有绘本数据，显示空状态
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

  // 获取当前页的作品列表
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
          {/* 涂色画布层 - 接收用户交互 */}
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
          {/* 线稿画布层 - 只显示，不接收交互 */}
          <canvas
            ref={lineArtCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: "multiply" }}
          />
          {/* 原图预览层 - 半透明显示，帮助参考 */}
          {showOriginal && page && (
            <img
              src={page.illustrationUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50"
            />
          )}

          {/* 左翻页按钮 */}
          {!isFirstPage && (
            <button
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors active:scale-95"
            >
              <ChevronLeft className="w-6 h-6 text-warm-brown" />
            </button>
          )}

          {/* 右翻页按钮 */}
          {!isLastPage && (
            <button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors active:scale-95"
            >
              <ChevronRight className="w-6 h-6 text-warm-brown" />
            </button>
          )}
        </div>

        {/* 页码和操作提示 */}
        <div className="mt-2 text-center">
          <span className="text-warm-brown/50 font-body text-sm">
            第 {currentPage + 1} 页 / 共 {totalPages} 页 · 点击填色，按住拖动涂色，Shift+点击区域填充
          </span>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 撤销重做清空按钮组 */}
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

            {/* 工具切换按钮组 */}
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

            {/* 保存和下载按钮组 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl font-body text-sm transition-all ${
                  showGallery
                    ? "bg-purple-500 text-white shadow-md"
                    : "bg-purple-100 text-purple-600 hover:bg-purple-20"
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
