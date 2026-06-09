/**
 * 线稿提取工具
 * 用于从彩色插画中提取线稿，确保涂色区域与原页面元素位置完全一致
 */

/**
 * 从图片URL提取线稿
 * 使用改进的边缘检测算法，确保线稿与原图元素位置精确对齐
 * @param imageUrl 原图URL
 * @returns 线稿图片的DataURL
 */
export async function extractLineArt(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 创建图片对象
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // 创建画布和上下文
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        // 使用原图尺寸，确保1:1比例，避免变形
        const width = img.width
        const height = img.height
        canvas.width = width
        canvas.height = height

        // 将原图绘制到画布上
        ctx.drawImage(img, 0, 0, width, height)

        // 获取图像像素数据
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // 第一步：转换为灰度图
        const grayscale = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) {
          const r = data[i * 4]
          const g = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          // 使用标准灰度转换公式：0.299*R + 0.587*G + 0.114*B
          grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        // 第二步：高斯模糊预处理，减少噪声影响
        const blurred = applyGaussianBlur(grayscale, width, height, 1.0)

        // 第三步：使用Sobel算子进行边缘检测
        const edges = detectEdges(blurred, width, height)

        // 第四步：计算自适应阈值
        const threshold = calculateAdaptiveThreshold(edges)

        // 第五步：二值化处理，生成线稿
        for (let i = 0; i < width * height; i++) {
          const edge = edges[i]
          // 边缘像素为黑色，非边缘为白色
          const isEdge = edge > threshold
          const value = isEdge ? 0 : 255

          // 设置RGB通道
          data[i * 4] = value
          data[i * 4 + 1] = value
          data[i * 4 + 2] = value
          // 确保完全不透明
          data[i * 4 + 3] = 255
        }

        // 将处理后的图像数据放回画布
        ctx.putImageData(imageData, 0, 0)

        // 返回PNG格式的DataURL
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for line art extraction'))
    }

    img.src = imageUrl
  })
}

/**
 * 应用高斯模糊
 * 用于预处理图像，减少噪声，提高边缘检测质量
 * @param input 输入像素数组
 * @param width 图像宽度
 * @param height 图像高度
 * @param sigma 高斯模糊标准差
 * @returns 模糊后的像素数组
 */
function applyGaussianBlur(input: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const output = new Float32Array(width * height)
  
  // 计算高斯核大小（通常为 sigma * 3 * 2 + 1）
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1
  const halfKernel = Math.floor(kernelSize / 2)
  
  // 生成一维高斯核
  const kernel = new Float32Array(kernelSize)
  let sum = 0
  
  for (let i = 0; i < kernelSize; i++) {
    const x = i - halfKernel
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    sum += kernel[i]
  }
  
  // 归一化高斯核
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum
  }
  
  // 水平方向模糊
  const temp = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0
      for (let k = -halfKernel; k <= halfKernel; k++) {
        const px = Math.min(Math.max(x + k, 0), width - 1)
        value += input[y * width + px] * kernel[k + halfKernel]
      }
      temp[y * width + x] = value
    }
  }
  
  // 垂直方向模糊
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0
      for (let k = -halfKernel; k <= halfKernel; k++) {
        const py = Math.min(Math.max(y + k, 0), height - 1)
        value += temp[py * width + x] * kernel[k + halfKernel]
      }
      output[y * width + x] = value
    }
  }
  
  return output
}

/**
 * 使用Sobel算子检测边缘
 * @param grayscale 灰度图像素数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 边缘强度数组
 */
function detectEdges(grayscale: Float32Array, width: number, height: number): Float32Array {
  // Sobel算子 - X方向
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ]
  
  // Sobel算子 - Y方向
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ]

  const edges = new Float32Array(width * height)

  // 遍历每个像素（跳过边缘像素）
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0

      // 应用3x3卷积核
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = grayscale[(y + ky) * width + (x + kx)]
          gx += pixel * sobelX[ky + 1][kx + 1]
          gy += pixel * sobelY[ky + 1][kx + 1]
        }
      }

      // 计算梯度幅值
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      edges[y * width + x] = magnitude
    }
  }

  return edges
}

/**
 * 计算自适应阈值
 * 使用Otsu方法或基于直方图的阈值计算
 * @param edges 边缘强度数组
 * @returns 阈值
 */
function calculateAdaptiveThreshold(edges: Float32Array): number {
  // 找到最大边缘强度
  let maxEdge = 0
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxEdge) maxEdge = edges[i]
  }

  // 使用较低的阈值以确保捕获更多边缘细节
  // 0.12的比例比原来的0.15更低，可以捕获更多细节
  return maxEdge * 0.12
}

/**
 * 获取备用线稿图（当API失败时使用）
 * 确保与备用插画使用完全相同的布局和元素位置
 * @param pageType 页面类型（cover/story/back）
 * @param index 页面索引
 * @returns 线稿SVG的DataURL
 */
export function getFallbackLineArt(pageType: string, index: number): string {
  // 画布尺寸与备用插画保持一致
  const width = 800
  const height = 600

  // 使用与备用插画完全相同的调色板索引，确保元素位置一致
  const palettes = [
    { accent: '#333333', elements: ['🐰', '🌸', '🌷', '🦋'] },
    { accent: '#333333', elements: ['🐻', '🌳', '🍄', '🌿'] },
    { accent: '#333333', elements: ['🐱', '⭐', '🌙', '✨'] },
    { accent: '#333333', elements: ['🦊', '🍂', '🌻', '🌈'] },
    { accent: '#333333', elements: ['🐼', '🎋', '🎍', '💮'] },
    { accent: '#333333', elements: ['🦄', '☁️', '🌠', '🎀'] },
  ]

  const palette = palettes[index % palettes.length]
  const strokeColor = palette.accent

  // 使用固定的随机种子，确保相同索引生成相同的布局
  const seededRandom = createSeededRandom(index)

  /**
   * 在指定范围内获取随机数
   * @param min 最小值
   * @param max 最大值
   * @returns 随机数
   */
  const getRandomInRange = (min: number, max: number) => seededRandom() * (max - min) + min

  /**
   * 生成emoji轮廓
   * 使用黑色描边和半透明填充，与原图元素位置完全一致
   * @param emoji emoji字符
   * @param x x坐标
   * @param y y坐标
   * @param size 字体大小
   * @returns SVG元素字符串
   */
  const outlineEmoji = (emoji: string, x: number, y: number, size: number) => `
    <g>
      <text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.8">${emoji}</text>
    </g>
  `

  let contentSvg = ''

  // 云朵轮廓 - 位置与备用插画完全一致
  const cloudOutlines = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
  `

  // 地面轮廓 - 位置与备用插画完全一致
  const groundOutline = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
  `

  // 装饰元素 - 使用相同的种子确保位置一致
  const decorativeOutlines = palette.elements.map((emoji) => {
    const x = getRandomInRange(80, width - 80)
    const y = getRandomInRange(100, height * 0.55)
    const size = getRandomInRange(40, 65)
    return outlineEmoji(emoji, x, y, size)
  }).join('')

  // 星星轮廓 - 使用相同的种子确保位置一致
  const starOutlines = Array.from({ length: 20 }, () => {
    const x = seededRandom() * width
    const y = seededRandom() * height * 0.4
    const r = getRandomInRange(2, 4)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.4" />`
  }).join('')

  // 花朵轮廓 - 位置与备用插画完全一致
  const flowerOutlines = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (width - 100) / 7
    const y = height * 0.78 + Math.sin(i) * 15
    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="-10" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
        <circle cx="-8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
        <circle cx="8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
        <circle cx="-5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
        <circle cx="5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
        <circle cx="0" cy="-1" r="5" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.5" />
      </g>
    `
  }).join('')

  const bigEmoji = palette.elements[0]

  // 根据页面类型生成不同的布局 - 与备用插画完全对应
  if (pageType === 'cover') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.4" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.3" />
      ${outlineEmoji(bigEmoji, width / 2, height / 2 - 20, 120)}
      ${flowerOutlines}
      ${groundOutline}
    `
  } else if (pageType === 'back') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      ${decorativeOutlines}
      ${outlineEmoji('💫', width / 2, height / 2, 80)}
      ${flowerOutlines}
      ${groundOutline}
    `
  } else {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2 - 150}" cy="${height * 0.4}" r="60" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.3" />
      <circle cx="${width / 2 + 150}" cy="${height * 0.35}" r="50" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.25" />
      ${decorativeOutlines}
      ${outlineEmoji(bigEmoji, width / 2 - 150, height * 0.4 + 20, 80)}
      ${outlineEmoji(palette.elements[1], width / 2 + 150, height * 0.38, 60)}
      ${flowerOutlines}
      ${groundOutline}
    `
  }

  // 构建完整的SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#ffffff" />
      ${contentSvg}
    </svg>
  `

  // 转换为base64编码的DataURL
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

/**
 * 创建种子随机数生成器
 * 确保相同的种子生成相同的随机数序列，用于保持元素位置一致
 * @param seed 随机种子
 * @returns 随机数生成函数
 */
function createSeededRandom(seed: number): () => number {
  let s = seed
  return function() {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
