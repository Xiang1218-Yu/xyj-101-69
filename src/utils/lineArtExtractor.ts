/**
 * ============================================================================
 * 线稿提取器 (Line Art Extractor)
 * ============================================================================
 *
 * 本模块负责将彩色插画转换为黑白线稿（涂色页）。
 *
 * 两条技术路径：
 * 1. 对位图（AI生成的PNG/JPEG）：使用图像处理算法（高斯模糊→Sobel边缘检测→细线化）
 * 2. 对内嵌SVG（fallback插画）：直接生成与插画元素一一对应的轮廓SVG，不经过位图转换
 *    → 这保证了线稿与原图100%一致，无杂线、无形状变形
 *
 * 线条要求：细而清晰，封闭区域完整，适合儿童涂色。
 */

// ============================================================================
// 共享常量（与 imageGenerator.ts 保持完全同步）
// ============================================================================

/** 调色板配置 - 与 imageGenerator.ts 完全一致 */
const PALETTES = [
  { bg1: '#FFE5EC', bg2: '#FFB6C1', accent: '#FF6B6B', elements: ['🐰', '🌸', '🌷', '🦋'] },
  { bg1: '#E8F4F8', bg2: '#B4E1E8', accent: '#7EC8A4', elements: ['🐻', '🌳', '🍄', '🌿'] },
  { bg1: '#FFF0F5', bg2: '#E6D5F0', accent: '#C4A8FF', elements: ['🐱', '⭐', '🌙', '✨'] },
  { bg1: '#F0FFF4', bg2: '#D4F1E8', accent: '#87CEEB', elements: ['🦊', '🍂', '🌻', '🌈'] },
  { bg1: '#FFF8F0', bg2: '#FFE4C9', accent: '#FF6B6B', elements: ['🐼', '🎋', '🎍', '💮'] },
  { bg1: '#F5F0FF', bg2: '#E0D5FF', accent: '#7EC8A4', elements: ['🦄', '☁️', '🌠', '🎀'] },
]

/** 画布尺寸常量 */
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

/** 线稿描边颜色 */
const STROKE = '#111111'

// ============================================================================
// 确定性种子随机（与 imageGenerator.ts 完全相同的算法和种子公式）
// ============================================================================

/** mulberry32 确定性伪随机数生成器 */
function createSeededRandom(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 布局数据接口 */
interface LayoutData {
  decorations: Array<{ emoji: string; x: number; y: number; size: number }>
  stars: Array<{ x: number; y: number; r: number }>
  flowers: Array<{ x: number; y: number }>
}

/**
 * 根据页面索引确定性生成布局数据
 * 种子公式：index * 1000 + 7，与 imageGenerator.ts 完全一致
 */
function generateLayout(pageType: string, index: number): LayoutData {
  const rand = createSeededRandom(index * 1000 + 7)
  const palette = PALETTES[index % PALETTES.length]
  void palette
  void pageType

  const getRandomInRange = (min: number, max: number) => rand() * (max - min) + min

  const decorations = PALETTES[index % PALETTES.length].elements.map((emoji) => ({
    emoji,
    x: getRandomInRange(80, CANVAS_WIDTH - 80),
    y: getRandomInRange(100, CANVAS_HEIGHT * 0.55),
    size: getRandomInRange(40, 65),
  }))

  const stars = Array.from({ length: 20 }, () => ({
    x: rand() * CANVAS_WIDTH,
    y: rand() * CANVAS_HEIGHT * 0.4,
    r: getRandomInRange(2, 4),
  }))

  const flowers = Array.from({ length: 8 }, (_, i) => ({
    x: 50 + i * (CANVAS_WIDTH - 100) / 7,
    y: CANVAS_HEIGHT * 0.78 + Math.sin(i) * 15,
  }))

  return { decorations, stars, flowers }
}

// ============================================================================
// 位图线稿提取算法（用于AI生成的真实图片）
// ============================================================================

/** 生成一维高斯核（归一化） */
function createGaussianKernel(sigma: number): number[] {
  const radius = Math.ceil(sigma * 3)
  const kernel: number[] = []
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel.push(val)
    sum += val
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum
  return kernel
}

/** 可分离高斯模糊（先水平再垂直，性能优化） */
function gaussianBlur(gray: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const kernel = createGaussianKernel(sigma)
  const radius = Math.floor(kernel.length / 2)
  const temp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const px = Math.min(Math.max(x + k, 0), w - 1)
        sum += gray[y * w + px] * kernel[k + radius]
      }
      temp[y * w + x] = sum
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const py = Math.min(Math.max(y + k, 0), h - 1)
        sum += temp[py * w + x] * kernel[k + radius]
      }
      out[y * w + x] = sum
    }
  }
  return out
}

/** Sobel边缘检测 */
function sobelDetect(gray: Float32Array, w: number, h: number) {
  const kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
  const ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
  const mag = new Float32Array(w * h)
  let maxVal = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const p = gray[(y + dy) * w + (x + dx)]
          gx += p * kx[dy + 1][dx + 1]
          gy += p * ky[dy + 1][dx + 1]
        }
      }
      const m = Math.sqrt(gx * gx + gy * gy)
      mag[y * w + x] = m
      if (m > maxVal) maxVal = m
    }
  }
  return { mag, maxVal }
}

/**
 * 形态学膨胀（细线化：仅1次迭代，让线稿封闭但不会过粗）
 * 使用十字形结构元素（上下左右）代替方形，膨胀幅度更小
 */
function dilateThin(edges: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (edges[idx]) {
        out[idx] = 1
        // 十字形膨胀：仅上下左右4邻域（比8邻域细一半）
        if (x + 1 < w) out[idx + 1] = 1
        if (x - 1 >= 0) out[idx - 1] = 1
        if (y + 1 < h) out[idx + w] = 1
        if (y - 1 >= 0) out[idx - w] = 1
      }
    }
  }
  return out
}

/**
 * 从位图图像中提取细线稿（涂色页）
 *
 * 处理流程：
 * 原图 → 灰度 → 高斯模糊(σ=1.0轻度降噪) → Sobel → 高阈值二值化(减少杂线) → 十字形1次膨胀(封闭间隙)
 *
 * 参数优化目标：线条细(约1-2px)、杂线少、主要轮廓清晰
 */
export async function extractLineArt(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('no ctx')); return }
        const w = img.width, h = img.height
        canvas.width = w; canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const data = imageData.data

        // 灰度转换
        const gray = new Float32Array(w * h)
        for (let i = 0; i < w * h; i++) {
          gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
        }

        // 轻度高斯模糊（σ=1.0，比之前1.4更精细，保留更多细节）
        const blurred = gaussianBlur(gray, w, h, 1.0)

        // Sobel
        const { mag, maxVal } = sobelDetect(blurred, w, h)

        // 高阈值二值化（0.2*maxVal，比之前0.12更严格，过滤弱纹理/渐变产生的杂线）
        // 不使用双阈值滞后，直接单阈值高门限，结果更干净
        const threshold = maxVal * 0.20
        const edges = new Uint8Array(w * h)
        for (let i = 0; i < w * h; i++) {
          if (mag[i] > threshold) edges[i] = 1
        }

        // 十字形1次膨胀：仅封闭最小间隙，不加粗太多
        const dilated = dilateThin(edges, w, h)

        // 输出：白底+极细黑线
        for (let i = 0; i < w * h; i++) {
          const v = dilated[i] ? 0 : 255
          data[i * 4] = v
          data[i * 4 + 1] = v
          data[i * 4 + 2] = v
          data[i * 4 + 3] = 255
        }
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('img load error'))
    img.src = imageUrl
  })
}

// ============================================================================
// Fallback SVG 线稿生成（与彩色插画100%元素对应的轮廓SVG）
// ============================================================================

/**
 * 判断URL是否为SVG data URL（fallback插画）
 */
export function isSvgDataUrl(url: string): boolean {
  return url.startsWith('data:image/svg+xml')
}

/**
 * emoji轮廓辅助函数：用SVG paint-order: stroke 在文字上叠加描边，
 * 视觉上产生文字形状的粗轮廓效果，模拟"涂色轮廓"
 */
function emojiOutline(emoji: string, x: number, y: number, size: number): string {
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" stroke="${STROKE}" stroke-width="2" paint-order="stroke" opacity="0.85">${emoji}</text>`
}

/**
 * 获取Fallback线稿SVG
 *
 * 设计原则：与 getFallbackIllustration 中的每一个视觉元素精确对应。
 * 将插画中所有"填充形状"转换为"空心描边形状"，背景渐变和光晕不保留（白色背景）。
 *
 * 包含的轮廓元素：
 * - 云朵（5个椭圆的描边）
 * - 草地（2条波浪路径的描边）
 * - 装饰圆（cover/story页面的圆形装饰）
 * - 装饰emoji（文字描边效果）
 * - 星星（小圆圈描边）
 * - 花朵（5片花瓣圆+花心圆的描边）
 * - 封面/封底的中心装饰圆
 */
export function getFallbackLineArt(pageType: string, index: number): string {
  const palette = PALETTES[index % PALETTES.length]
  const layout = generateLayout(pageType, index)
  const SW = 1.8 // 统一描边宽度，细而清晰

  // —— 云朵轮廓（与彩色插画位置完全一致）——
  const cloudStrokes = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
  `

  // —— 草地轮廓（与彩色插画位置完全一致，闭合路径描边）——
  const groundStrokes = `
    <path d="M 0 ${CANVAS_HEIGHT * 0.7} Q ${CANVAS_WIDTH * 0.25} ${CANVAS_HEIGHT * 0.65}, ${CANVAS_WIDTH * 0.5} ${CANVAS_HEIGHT * 0.72} T ${CANVAS_WIDTH} ${CANVAS_HEIGHT * 0.7}" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 0 ${CANVAS_HEIGHT * 0.75} Q ${CANVAS_WIDTH * 0.3} ${CANVAS_HEIGHT * 0.7}, ${CANVAS_WIDTH * 0.6} ${CANVAS_HEIGHT * 0.78} T ${CANVAS_WIDTH} ${CANVAS_HEIGHT * 0.75}" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
  `

  // —— 装饰emoji轮廓（位置/大小与彩色插画完全一致）——
  const decoStrokes = layout.decorations
    .map((d) => emojiOutline(d.emoji, d.x, d.y, d.size))
    .join('')

  // —— 星星轮廓（小圆描边，位置与彩色插画一致）——
  const starStrokes = layout.stars
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="none" stroke="${STROKE}" stroke-width="1.2"/>`)
    .join('')

  // —— 花朵轮廓（每片花瓣+花心都是空心圆，位置与彩色插画一致）——
  const flowerStrokes = layout.flowers
    .map((f) => `
      <g transform="translate(${f.x}, ${f.y})">
        <circle cx="0" cy="-10" r="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="-8" cy="-2" r="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="8" cy="-2" r="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="-5" cy="6" r="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="5" cy="6" r="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="0" cy="-1" r="5" fill="none" stroke="${STROKE}" stroke-width="${SW * 0.8}"/>
      </g>`)
    .join('')

  const bigEmoji = palette.elements[0]

  // —— 根据页面类型拼装线稿内容（每个形状与彩色插画一一对应）——
  let content = ''
  if (pageType === 'cover') {
    content = `
      ${starStrokes}
      ${cloudStrokes}
      <circle cx="${CANVAS_WIDTH / 2}" cy="${CANVAS_HEIGHT / 2 - 40}" r="120" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
      <circle cx="${CANVAS_WIDTH / 2}" cy="${CANVAS_HEIGHT / 2 - 40}" r="100" fill="none" stroke="${STROKE}" stroke-width="${SW * 0.7}" opacity="0.6"/>
      ${emojiOutline(bigEmoji, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, 120)}
      ${flowerStrokes}
      ${groundStrokes}
    `
  } else if (pageType === 'back') {
    content = `
      ${starStrokes}
      ${cloudStrokes}
      ${decoStrokes}
      ${emojiOutline('💫', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 80)}
      ${flowerStrokes}
      ${groundStrokes}
    `
  } else {
    // story page
    content = `
      ${starStrokes}
      ${cloudStrokes}
      <circle cx="${CANVAS_WIDTH / 2 - 150}" cy="${CANVAS_HEIGHT * 0.4}" r="60" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>
      <circle cx="${CANVAS_WIDTH / 2 + 150}" cy="${CANVAS_HEIGHT * 0.35}" r="50" fill="none" stroke="${STROKE}" stroke-width="${SW * 0.7}" opacity="0.6"/>
      ${decoStrokes}
      ${emojiOutline(bigEmoji, CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT * 0.4 + 20, 80)}
      ${emojiOutline(palette.elements[1], CANVAS_WIDTH / 2 + 150, CANVAS_HEIGHT * 0.38, 60)}
      ${flowerStrokes}
      ${groundStrokes}
    `
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
  <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff"/>
  ${content}
</svg>`

  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}
