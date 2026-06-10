/**
 * 线稿提取模块
 *
 * 算法流程（针对儿童绘本插图的柔和色彩优化）：
 * 1. 高斯模糊降噪（消除纹理噪声）
 * 2. Sobel亮度边缘检测（捕捉亮度梯度边界）
 * 3. 颜色边缘检测（仅捕捉显著颜色边界，忽略柔和渐变）
 * 4. 融合边缘：Sobel为主，颜色边缘为辅（仅当颜色差异超过阈值时才纳入）
 * 5. 自适应阈值 + 滞后阈值化（95百分位，约5%像素为边缘）
 * 6. 形态学闭运算（1膨胀+1腐蚀，连接断裂线条）
 * 7. 形态学膨胀（1次，线条加粗到约3px）
 */

/**
 * 3x3高斯模糊
 * 使用标准高斯核平滑图像，减少噪声对边缘检测的干扰
 * 核权重：[1,2,1; 2,4,2; 1,2,1] / 16
 */
function gaussianBlur(data: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(width * height)
  const kernel = [1 / 16, 2 / 16, 1 / 16, 2 / 16, 4 / 16, 2 / 16, 1 / 16, 2 / 16, 1 / 16]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0
      let ki = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += data[(y + ky) * width + (x + kx)] * kernel[ki++]
        }
      }
      result[y * width + x] = sum
    }
  }

  /* 边界像素直接复制原值 */
  for (let x = 0; x < width; x++) {
    result[x] = data[x]
    result[(height - 1) * width + x] = data[(height - 1) * width + x]
  }
  for (let y = 0; y < height; y++) {
    result[y * width] = data[y * width]
    result[y * width + width - 1] = data[y * width + width - 1]
  }

  return result
}

/**
 * Sobel边缘检测（灰度图）
 * 检测亮度梯度变化产生的边缘
 * 使用3x3 Sobel算子分别计算水平和垂直方向的梯度
 */
function sobelEdgeDetection(grayscale: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height)
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = grayscale[(y + ky) * width + (x + kx)]
          gx += pixel * sobelX[ky + 1][kx + 1]
          gy += pixel * sobelY[ky + 1][kx + 1]
        }
      }
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }

  return edges
}

/**
 * 颜色感知的边缘检测（带最小阈值）
 *
 * 关键改进：只有当RGB欧氏距离超过 MIN_COLOR_DIST 时才视为边缘
 * 这能过滤掉柔和渐变中的微小颜色差异，只保留真正的颜色边界
 *
 * 例如：红蓝相邻区域（距离>50）会被检测为边缘
 *       柔和粉色渐变（距离<50）会被忽略
 */
function colorEdgeDetection(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height)

  /* 最小颜色距离阈值：低于此值的颜色差异视为渐变而非边界 */
  const MIN_COLOR_DIST = 50

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      let maxDist = 0

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          if (kx === 0 && ky === 0) continue
          const nIdx = ((y + ky) * width + (x + kx)) * 4
          const dr = r - data[nIdx]
          const dg = g - data[nIdx + 1]
          const db = b - data[nIdx + 2]
          const dist = Math.sqrt(dr * dr + dg * dg + db * db)
          if (dist > maxDist) maxDist = dist
        }
      }

      /* 只保留超过最小阈值的颜色差异，其余视为渐变忽略 */
      edges[y * width + x] = maxDist > MIN_COLOR_DIST ? maxDist : 0
    }
  }

  return edges
}

/**
 * 自适应阈值计算
 * 使用直方图百分位数法确定高阈值
 *
 * 关键改进：使用95百分位（约5%像素为边缘）
 * 之前的85百分位（15%边缘）加上形态学膨胀导致几乎全黑
 * 5%边缘经过1次膨胀后约10-12%为黑色，适合涂色页
 */
function computeAdaptiveThreshold(edges: Float32Array): number {
  const BINS = 256
  const histogram = new Uint32Array(BINS)
  let maxEdge = 0

  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxEdge) maxEdge = edges[i]
  }

  if (maxEdge === 0) return 1

  /* 将边缘值映射到直方图bins */
  for (let i = 0; i < edges.length; i++) {
    const bin = Math.min(BINS - 1, Math.floor((edges[i] / maxEdge) * BINS))
    histogram[bin]++
  }

  /* 使用95百分位：只有约5%的像素被标记为边缘 */
  const totalPixels = edges.length
  const targetCount = Math.floor(totalPixels * 0.95)
  let cumulative = 0

  for (let i = 0; i < BINS; i++) {
    cumulative += histogram[i]
    if (cumulative >= targetCount) {
      return (i / BINS) * maxEdge
    }
  }

  return maxEdge * 0.5
}

/**
 * 滞后阈值化（类Canny算法）
 * 使用高低两个阈值来保留连通的边缘，消除孤立的噪声边缘
 *
 * 算法步骤：
 * 1. 高于高阈值的像素标记为强边缘
 * 2. 介于高低阈值之间的像素标记为弱边缘
 * 3. 通过BFS从强边缘出发，将连接的弱边缘也保留
 * 4. 不与强边缘相连的弱边缘被丢弃（视为噪声）
 */
function hysteresisThreshold(
  edges: Float32Array,
  width: number,
  height: number,
  highThreshold: number
): Uint8Array {
  /* 低阈值为高阈值的40%，保留与强边缘相连的弱边缘 */
  const lowThreshold = highThreshold * 0.4
  const result = new Uint8Array(width * height)

  const STRONG = 2
  const WEAK = 1
  const labels = new Uint8Array(width * height)

  /* 第一步：标记强边缘和弱边缘 */
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] >= highThreshold) {
      labels[i] = STRONG
    } else if (edges[i] >= lowThreshold) {
      labels[i] = WEAK
    }
  }

  /* 第二步：BFS从强边缘扩展，保留连接的弱边缘 */
  const queue: number[] = []

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === STRONG) {
      result[i] = 1
      queue.push(i)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % width
    const y = Math.floor(idx / width)

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const nIdx = ny * width + nx
        if (labels[nIdx] === WEAK && result[nIdx] === 0) {
          result[nIdx] = 1
          labels[nIdx] = STRONG
          queue.push(nIdx)
        }
      }
    }
  }

  return result
}

/**
 * 形态学膨胀
 * 使用3x3核，将边缘像素周围的像素也标记为边缘
 * 每次迭代使线条加粗约2像素（每侧1像素）
 */
function morphologicalDilate(
  data: Uint8Array,
  width: number,
  height: number,
  iterations: number = 1
): Uint8Array {
  let current = new Uint8Array(data)

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(width * height)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        /* 如果3x3邻域内有任何边缘像素，则当前像素也标记为边缘 */
        let hasEdge = false
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (current[(y + ky) * width + (x + kx)] === 1) {
              hasEdge = true
              break
            }
          }
          if (hasEdge) break
        }
        next[y * width + x] = hasEdge ? 1 : 0
      }
    }
    current = next
  }

  return current
}

/**
 * 形态学腐蚀
 * 使用3x3核，只有当3x3邻域内全部是边缘像素时才保留
 * 用于闭运算中抵消膨胀的效果
 */
function morphologicalErode(data: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let allEdge = true
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          if (data[(y + ky) * width + (x + kx)] !== 1) {
            allEdge = false
            break
          }
        }
        if (!allEdge) break
      }
      result[y * width + x] = allEdge ? 1 : 0
    }
  }

  return result
}

/**
 * 形态学闭运算（先膨胀后腐蚀）
 * 用于连接断裂的线条，形成封闭的涂色区域
 *
 * 关键改进：使用1次膨胀+1次腐蚀（标准闭运算）
 * 之前的2膨胀+1腐蚀不是标准闭运算，会导致净膨胀效果
 * 1+1闭运算连接间隙但不增加线条粗细
 */
function morphologicalClose(data: Uint8Array, width: number, height: number): Uint8Array {
  const dilated = morphologicalDilate(data, width, height, 1)
  return morphologicalErode(dilated, width, height)
}

/**
 * 从彩色插图中提取线稿
 *
 * 算法针对儿童绘本插图优化：
 * - 柔和渐变不被误检为边缘（颜色距离阈值过滤）
 * - Sobel为主检测器，颜色边缘仅补充显著颜色边界
 * - 5%边缘率 + 1次膨胀 = 约10%黑色区域，适合涂色
 * - 闭运算连接断裂线条，1次膨胀使线条约3px宽
 *
 * @param imageUrl 原始插图URL
 * @returns 线稿PNG的DataURL（白底黑线）
 */
export async function extractLineArt(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        const width = img.width
        const height = img.height
        canvas.width = width
        canvas.height = height

        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        /* 第一步：灰度化，用于Sobel亮度边缘检测 */
        const grayscale = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) {
          const r = data[i * 4]
          const g = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        /* 第二步：高斯模糊降噪，避免噪声产生虚假边缘 */
        const blurred = gaussianBlur(grayscale, width, height)

        /* 第三步：Sobel亮度边缘检测（主检测器） */
        const sobelEdges = sobelEdgeDetection(blurred, width, height)

        /* 第四步：颜色边缘检测（辅助检测器，仅捕捉显著颜色边界） */
        const colorEdges = colorEdgeDetection(data, width, height)

        /* 第五步：融合边缘 — Sobel为主，颜色边缘为辅
         *
         * 关键改进：不再归一化后取max（会放大渐变噪声）
         * 改为：Sobel归一化值 + 颜色边缘归一化值（仅当颜色差异显著时）
         * 这样Sobel检测到的亮度边界始终保留，
         * 颜色边界只在差异显著时才补充进来
         */
        let maxSobelEdge = 0
        let maxColorEdge = 0
        for (let i = 0; i < sobelEdges.length; i++) {
          if (sobelEdges[i] > maxSobelEdge) maxSobelEdge = sobelEdges[i]
          if (colorEdges[i] > maxColorEdge) maxColorEdge = colorEdges[i]
        }

        const combinedEdges = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) {
          const sobelVal = maxSobelEdge > 0 ? sobelEdges[i] / maxSobelEdge : 0

          /* 颜色边缘只在超过阈值时才纳入，避免柔和渐变被误判 */
          const colorVal = colorEdges[i] > 0 && maxColorEdge > 0
            ? colorEdges[i] / maxColorEdge
            : 0

          /* 取最大值：Sobel检测到的亮度边界 或 显著的颜色边界 */
          combinedEdges[i] = Math.max(sobelVal, colorVal)
        }

        /* 第六步：自适应阈值计算（95百分位，约5%像素为边缘） */
        const highThreshold = computeAdaptiveThreshold(combinedEdges)

        /* 第七步：滞后阈值化，保留连通边缘，消除孤立噪声 */
        const binary = hysteresisThreshold(combinedEdges, width, height, highThreshold)

        /* 第八步：形态学闭运算（1膨胀+1腐蚀），连接断裂线条 */
        const closed = morphologicalClose(binary, width, height)

        /* 第九步：形态学膨胀1次，线条从1px加粗到约3px
         * 3px宽的线条足以防止洪水填充越界 */
        const thickened = morphologicalDilate(closed, width, height, 1)

        /* 第十步：写入结果图像（边缘=黑色，非边缘=白色） */
        for (let i = 0; i < width * height; i++) {
          const value = thickened[i] ? 0 : 255
          data[i * 4] = value
          data[i * 4 + 1] = value
          data[i * 4 + 2] = value
          data[i * 4 + 3] = 255
        }

        ctx.putImageData(imageData, 0, 0)
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
 * 确定性伪随机数生成器
 * 使用线性同余法，确保相同种子产生相同序列
 * 用于让备用线稿和备用插图使用相同的元素位置
 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
}

/**
 * 备用线稿生成器
 *
 * 使用与 getFallbackIllustration 相同的确定性位置
 * 确保备用线稿的区域结构与备用插图完全一致
 * 使用 seededRandom 保证每次生成相同的结果
 */
export function getFallbackLineArt(pageType: string, index: number): string {
  const width = 800
  const height = 600

  /* 使用确定性随机数，确保线稿和插图位置一致 */
  const rng = seededRandom(index * 12345 + 67890)
  const getRandomInRange = (min: number, max: number) => rng() * (max - min) + min

  /* 线条颜色使用深黑色，确保在白色背景上清晰可见 */
  const strokeColor = '#222222'

  /* 云朵轮廓 — 位置与 getFallbackIllustration 完全一致 */
  const cloudOutlines = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${strokeColor}" stroke-width="2" />
  `

  /* 地面轮廓 — 位置与 getFallbackIllustration 完全一致 */
  const groundOutline = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="2" />
  `

  /* 装饰元素轮廓 — 使用确定性随机位置 */
  const palettes = [
    ['🐰', '🌸', '🌷', '🦋'],
    ['🐻', '🌳', '🍄', '🌿'],
    ['🐱', '⭐', '🌙', '✨'],
    ['🦊', '🍂', '🌻', '🌈'],
    ['🐼', '🎋', '🎍', '💮'],
    ['🦄', '☁️', '🌠', '🎀'],
  ]
  const palette = palettes[index % palettes.length]

  const decorativeOutlines = palette.map((emoji) => {
    const x = getRandomInRange(80, width - 80)
    const y = getRandomInRange(100, height * 0.55)
    const size = getRandomInRange(40, 65)
    return `
      <g>
        <text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2">${emoji}</text>
      </g>
    `
  }).join('')

  /* 星星轮廓 — 使用确定性随机位置 */
  const starOutlines = Array.from({ length: 20 }, () => {
    const x = rng() * width
    const y = rng() * height * 0.4
    const r = getRandomInRange(2, 4)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="1.5" />`
  }).join('')

  /* 花朵轮廓 — 位置与 getFallbackIllustration 完全一致 */
  const flowerOutlines = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (width - 100) / 7
    const y = height * 0.78 + Math.sin(i) * 15
    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="-10" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
        <circle cx="-8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
        <circle cx="8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
        <circle cx="-5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
        <circle cx="5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
        <circle cx="0" cy="-1" r="5" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      </g>
    `
  }).join('')

  const bigEmoji = palette[0]

  let contentSvg = ''

  if (pageType === 'cover') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="none" stroke="${strokeColor}" stroke-width="2" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      <text x="${width / 2}" y="${height / 2 - 20}" font-size="120" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2">${bigEmoji}</text>
      ${flowerOutlines}
      ${groundOutline}
    `
  } else if (pageType === 'back') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      ${decorativeOutlines}
      <text x="${width / 2}" y="${height / 2}" font-size="80" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2">💫</text>
      ${flowerOutlines}
      ${groundOutline}
    `
  } else {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2 - 150}" cy="${height * 0.4}" r="60" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      <circle cx="${width / 2 + 150}" cy="${height * 0.35}" r="50" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      ${decorativeOutlines}
      <text x="${width / 2 - 150}" y="${height * 0.4 + 20}" font-size="80" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2">${bigEmoji}</text>
      <text x="${width / 2 + 150}" y="${height * 0.38}" font-size="60" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2">${palette[1]}</text>
      ${flowerOutlines}
      ${groundOutline}
    `
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#ffffff" />
      ${contentSvg}
    </svg>
  `

  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}
