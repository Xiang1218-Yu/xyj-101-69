/**
 * 线稿提取工具
 * --------------------------------------------------------------------
 * 设计原则：
 * 1. 涂色页（线稿）必须由"原插画"推导而来，禁止生成任何与原页面元素无关
 *    的占位内容（如随机花朵、emoji 等），以确保涂色区域与原页面元素完全一致。
 * 2. 主流程通过 Canvas + Sobel 边缘检测生成黑白线稿；
 *    若 Canvas 被跨域污染或像素读取失败，则降级到基于"原插画"的 SVG 滤镜方案；
 *    最终兜底直接返回原插画 URL，保证元素布局与原页面 1:1 对应。
 */

// 工具：加载图片，统一返回 HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 显式声明匿名跨域，便于读取像素；对 blob:/data: URL 也是安全的
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for line art extraction"));
    img.src = src;
  });
}

// 工具：将任意可访问的图片 URL 转为 base64 data URL
// 用途：把 blob:/http(s) 资源内嵌进 SVG，避免 <img src="*.svg"> 加载时
// 浏览器拒绝从 SVG 内部再去拉取外部资源（这是导致兜底线稿"丢元素"的常见原因）。
async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image as data URL"));
    reader.readAsDataURL(blob);
  });
}

// 3x3 高斯模糊，平滑掉噪点，使后续边缘更连续、更接近原画轮廓
function gaussianBlur3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 边界像素直接复制，避免越界
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        out[y * w + x] = src[y * w + x];
        continue;
      }
      // 卷积核 [[1,2,1],[2,4,2],[1,2,1]] / 16
      const sum =
        src[(y - 1) * w + (x - 1)] + 2 * src[(y - 1) * w + x] + src[(y - 1) * w + (x + 1)] +
        2 * src[y * w + (x - 1)]    + 4 * src[y * w + x]      + 2 * src[y * w + (x + 1)] +
        src[(y + 1) * w + (x - 1)] + 2 * src[(y + 1) * w + x] + src[(y + 1) * w + (x + 1)];
      out[y * w + x] = sum / 16;
    }
  }
  return out;
}

// Sobel 边缘检测，输出每个像素的梯度强度
function sobel(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = src[(y - 1) * w + (x - 1)];
      const tc = src[(y - 1) * w + x];
      const tr = src[(y - 1) * w + (x + 1)];
      const ml = src[y * w + (x - 1)];
      const mr = src[y * w + (x + 1)];
      const bl = src[(y + 1) * w + (x - 1)];
      const bc = src[(y + 1) * w + x];
      const br = src[(y + 1) * w + (x + 1)];
      // x 方向梯度
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      // y 方向梯度
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      out[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/**
 * 主入口：从原始插画中提取线稿（白底黑线）。
 * 失败时抛错，由调用方调用 getFallbackLineArt 进行降级。
 */
export async function extractLineArt(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  // 优先使用图片自身分辨率，确保线稿与原图像素级对齐
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context not available");

  // 先铺白底，避免 PNG 透明像素影响后续二值化
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 读取像素：若被跨域污染会抛出 SecurityError，让上层进入降级分支
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 1) 转灰度（保持与原画相同的形状/位置）
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // 2) 高斯模糊降噪
  const blurred = gaussianBlur3(gray, width, height);

  // 3) Sobel 边缘检测
  const edges = sobel(blurred, width, height);

  // 4) 自适应阈值二值化：阈值与最大梯度成比例
  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxEdge) maxEdge = edges[i];
  }
  // 0.18 是经验值，能在保留主轮廓的同时抑制纸张噪点
  const threshold = maxEdge * 0.18;

  for (let i = 0; i < width * height; i++) {
    const v = edges[i] > threshold ? 0 : 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * 兜底线稿：当主流程失败（例如跨域污染、解码异常）时使用。
 * 关键点：底图依然是"原插画本身"，仅通过 SVG 滤镜做高对比灰度处理，
 *        从而让元素布局/形状与原页面保持一致，绝不引入无关元素。
 */
export async function getFallbackLineArt(
  imageUrl: string,
  width: number = 800,
  height: number = 600
): Promise<string> {
  // 把原图转成 data URL 内嵌进 SVG，规避 <img> 加载 SVG 时无法访问外部 blob 资源的限制
  const embeddedHref = await urlToDataUrl(imageUrl);

  // 通过 SVG 滤镜：去色 -> 拉高对比度 -> 提亮，得到接近线稿的高对比效果
  // 该方案不需要读取像素，绕过跨域污染问题
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <filter id="la" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <!-- 转灰度 -->
      <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"/>
      <!-- 拉高对比度，使深色轮廓变黑、浅色区域变白 -->
      <feComponentTransfer>
        <feFuncR type="linear" slope="3" intercept="-1"/>
        <feFuncG type="linear" slope="3" intercept="-1"/>
        <feFuncB type="linear" slope="3" intercept="-1"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <!-- 白底，与主流程保持一致，方便涂色画布混合 -->
  <rect width="100%" height="100%" fill="#ffffff"/>
  <image xlink:href="${embeddedHref}" href="${embeddedHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" filter="url(#la)"/>
</svg>`;

  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}
