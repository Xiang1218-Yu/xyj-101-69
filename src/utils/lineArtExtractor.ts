/**
 * 线稿提取模块
 *
 * 核心问题：儿童绘本插图有柔和渐变和阴影，直接边缘检测会把渐变也检测为边缘，
 * 导致元素内部被黑色填充而非仅保留轮廓线。
 *
 * 解决方案：
 * 1. 色彩量化（Posterize）：将颜色减少到有限数量，消除渐变和阴影
 *    - 渐变区域被合并为单一颜色，不再产生边缘
 *    - 只有真正不同颜色区域之间的边界才产生边缘
 * 2. 非极大值抑制（NMS）：将边缘细化到1像素宽
 *    - 防止粗边缘带在形态学运算后合并成填充区域
 * 3. 最小形态学运算：仅1次膨胀使线条2-3px宽
 *
 * 完整流程：
 * 1. 色彩量化（step=64，每通道4级，共64种颜色）
 * 2. 灰度化
 * 3. 高斯模糊（2次，消除量化产生的锯齿）
 * 4. Sobel边缘检测
 * 5. 非极大值抑制（细化到1px）
 * 6. 自适应阈值化（97百分位）
 * 7. 形态学膨胀（1次，线条2-3px宽）
 */

/**
 * 3x3高斯模糊
 * 标准高斯核：[1,2,1; 2,4,2; 1,2,1] / 16
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
 * 色彩量化（Posterize）
 *
 * 将每个RGB通道的值舍入到最近的 step 倍数
 * 例如 step=64 时，每通道只有4个级别：0, 64, 128, 192, (256→255)
 * 总共约 5^3 = 125 种可能颜色
 *
 * 关键作用：
 * - 消除柔和渐变：渐变中的微小颜色差异被合并为同一量化值
 * - 保留显著边界：不同颜色区域量化后仍为不同值
 * - 消除阴影：阴影造成的颜色偏移被量化掉
 */
function posterize(data: Uint8ClampedArray, step: number): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step
    data[i + 1] = Math.round(data[i + 1] / step) * step
    data[i + 2] = Math.round(data[i + 2] / step) * step
    /* 钳制到0-255范围 */
    data[i] = Math.min(255, data[i])
    data[i + 1] = Math.min(255, data[i + 1])
    data[i + 2] = Math.min(255, data[i + 2])
  }
}

/**
 * Sobel边缘检测（灰度图）
 * 使用3x3 Sobel算子计算水平和垂直方向梯度
 */
function sobelEdgeDetection(grayscale: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height)
  /* 同时计算梯度方向，用于非极大值抑制 */
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
 * 非极大值抑制（Non-Maximum Suppression）
 *
 * 类似Canny算法中的NMS步骤，将边缘细化到1像素宽
 * 对于每个边缘像素，检查其梯度方向上的两个邻居：
 * - 如果当前像素值 >= 两个邻居值，保留（是局部最大值）
 * - 否则抑制为0（不是边缘的脊线）
 *
 * 关键作用：防止粗边缘带在形态学运算后合并成填充区域
 * 没有NMS时，Sobel在边界处产生2-3px宽的边缘带，
 * 膨胀后变成4-5px宽，多个边缘带合并就形成黑色填充
 * 有NMS后，边缘只有1px宽，膨胀后2-3px，不会合并
 */
function nonMaxSuppression(edges: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const val = edges[idx]

      if (val === 0) continue

      /* 简化的NMS：检查4邻域（上下左右）是否为局部最大值 */
      const left = edges[idx - 1]
      const right = edges[idx + 1]
      const up = edges[idx - width]
      const down = edges[idx + width]

      /* 只保留沿梯度方向上的局部最大值 */
      if (val >= left && val >= right && val >= up && val >= down) {
        result[idx] = val
      }
    }
  }

  return result
}

/**
 * 自适应阈值计算
 * 使用直方图百分位数法确定阈值
 * 97百分位意味着约3%的像素被标记为边缘
 * 3%边缘 + 1次膨胀 ≈ 5-7%黑色区域，适合涂色页
 */
function computeAdaptiveThreshold(edges: Float32Array): number {
  const BINS = 256
  const histogram = new Uint32Array(BINS)
  let maxEdge = 0

  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxEdge) maxEdge = edges[i]
  }

  if (maxEdge === 0) return 1

  for (let i = 0; i < edges.length; i++) {
    const bin = Math.min(BINS - 1, Math.floor((edges[i] / maxEdge) * BINS))
    histogram[bin]++
  }

  /* 97百分位：约3%像素为边缘 */
  const totalPixels = edges.length
  const targetCount = Math.floor(totalPixels * 0.97)
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
 * 形态学膨胀
 * 使用3x3核，每次迭代使线条加粗约2像素（每侧1像素）
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
 * 从彩色插图中提取线稿
 *
 * 算法核心：先量化颜色消除渐变，再检测边缘只保留轮廓
 *
 * 量化后的效果：
 * - 天空渐变 → 单一蓝色区域（无边）
 * - 角色阴影 → 与角色同色（无边）
 * - 角色与背景 → 不同量化色（有边=轮廓线）
 * - 角色内部特征（眼睛等）→ 与角色不同色（有边=特征线）
 *
 * @param imageUrl 原始插图URL
 * @returns 线稿PNG的DataURL（白底黑线，仅轮廓）
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

        /* 第一步：色彩量化
         * step=64 将每通道量化为 0/64/128/192/255 共5级
         * 这会消除柔和渐变和阴影，只保留显著的颜色区域边界
         * 量化后渐变区域变为同一颜色，不再产生边缘 */
        posterize(data, 64)

        /* 第二步：灰度化 */
        const grayscale = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) {
          const r = data[i * 4]
          const g = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        /* 第三步：高斯模糊2次
         * 量化后颜色边界处会有1-2px的锯齿
         * 2次模糊平滑这些锯齿，使边缘检测更稳定
         * 同时进一步消除量化后残留的微小颜色差异 */
        let blurred = gaussianBlur(grayscale, width, height)
        blurred = gaussianBlur(blurred, width, height)

        /* 第四步：Sobel边缘检测
         * 量化后的图像只有显著边界，Sobel只检测到这些边界
         * 不会检测到渐变（已被量化消除） */
        const edges = sobelEdgeDetection(blurred, width, height)

        /* 第五步：非极大值抑制（NMS）
         * 将边缘细化到1像素宽，这是防止"黑色填充"的关键步骤
         * 没有NMS：Sobel在边界处产生2-3px宽的边缘带
         * 有NMS：边缘只有1px宽的脊线 */
        const thinned = nonMaxSuppression(edges, width, height)

        /* 第六步：自适应阈值化
         * 97百分位 ≈ 3%像素为边缘
         * 量化后的边缘非常干净，3%足以覆盖所有真实边界 */
        const threshold = computeAdaptiveThreshold(thinned)
        const binary = new Uint8Array(width * height)
        for (let i = 0; i < width * height; i++) {
          binary[i] = thinned[i] >= threshold ? 1 : 0
        }

        /* 第七步：形态学膨胀1次
         * NMS后的边缘只有1px，太细不利于涂色
         * 1次膨胀使线条变为2-3px宽，足以防止洪水填充越界
         * 不需要闭运算：量化后的边缘已经是连续的 */
        const thickened = morphologicalDilate(binary, width, height, 1)

        /* 第八步：写入结果（边缘=黑色，非边缘=白色） */
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
 * 线性同余法，相同种子产生相同序列
 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
}

/**
 * 生成五角星SVG路径
 * @param cx 中心X
 * @param cy 中心Y
 * @param outerR 外半径
 * @param innerR 内半径
 */
function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI / 5)
    const r = i % 2 === 0 ? outerR : innerR
    const x = cx + r * Math.cos(angle)
    const y = cy - r * Math.sin(angle)
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return points.join(' ') + ' Z'
}

/**
 * 生成动物轮廓SVG
 * 使用纯几何形状（圆、椭圆、路径），不依赖emoji
 * 确保在所有平台上都能正确渲染为轮廓线
 */
function animalOutline(type: string, cx: number, cy: number, scale: number, stroke: string): string {
  const s = scale
  const sw = 2

  switch (type) {
    case 'bunny':
      /* 兔子：圆头 + 长耳朵 + 眼睛 + 鼻子 */
      return `<g>
        <ellipse cx="${cx}" cy="${cy}" rx="${s * 0.4}" ry="${s * 0.35}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx - s * 0.12}" cy="${cy - s * 0.55}" rx="${s * 0.08}" ry="${s * 0.22}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx + s * 0.12}" cy="${cy - s * 0.55}" rx="${s * 0.08}" ry="${s * 0.22}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.12}" cy="${cy - s * 0.05}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.12}" cy="${cy - s * 0.05}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx}" cy="${cy + s * 0.08}" rx="${s * 0.04}" ry="${s * 0.03}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
      </g>`

    case 'bear':
      /* 熊：圆头 + 圆耳朵 + 眼睛 + 鼻子 */
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.38}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.12}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.12}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.12}" cy="${cy - s * 0.05}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.12}" cy="${cy - s * 0.05}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx}" cy="${cy + s * 0.1}" rx="${s * 0.08}" ry="${s * 0.06}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
      </g>`

    case 'cat':
      /* 猫：圆头 + 三角耳朵 + 眼睛 + 胡须 */
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.35}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx - s * 0.25},${cy - s * 0.2} ${cx - s * 0.35},${cy - s * 0.55} ${cx - s * 0.08},${cy - s * 0.3}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx + s * 0.25},${cy - s * 0.2} ${cx + s * 0.35},${cy - s * 0.55} ${cx + s * 0.08},${cy - s * 0.3}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.1}" cy="${cy - s * 0.03}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.1}" cy="${cy - s * 0.03}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <line x1="${cx - s * 0.3}" y1="${cy + s * 0.08}" x2="${cx - s * 0.08}" y2="${cy + s * 0.05}" stroke="${stroke}" stroke-width="1" />
        <line x1="${cx - s * 0.28}" y1="${cy + s * 0.14}" x2="${cx - s * 0.08}" y2="${cy + s * 0.1}" stroke="${stroke}" stroke-width="1" />
        <line x1="${cx + s * 0.3}" y1="${cy + s * 0.08}" x2="${cx + s * 0.08}" y2="${cy + s * 0.05}" stroke="${stroke}" stroke-width="1" />
        <line x1="${cx + s * 0.28}" y1="${cy + s * 0.14}" x2="${cx + s * 0.08}" y2="${cy + s * 0.1}" stroke="${stroke}" stroke-width="1" />
      </g>`

    case 'fox':
      /* 狐狸：圆头 + 尖耳朵 + 眼睛 + 尖鼻子 */
      return `<g>
        <ellipse cx="${cx}" cy="${cy + s * 0.05}" rx="${s * 0.35}" ry="${s * 0.3}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx - s * 0.2},${cy - s * 0.15} ${cx - s * 0.32},${cy - s * 0.5} ${cx - s * 0.05},${cy - s * 0.25}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx + s * 0.2},${cy - s * 0.15} ${cx + s * 0.32},${cy - s * 0.5} ${cx + s * 0.05},${cy - s * 0.25}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.1}" cy="${cy}" r="${s * 0.035}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.1}" cy="${cy}" r="${s * 0.035}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx},${cy + s * 0.12} ${cx - s * 0.05},${cy + s * 0.06} ${cx + s * 0.05},${cy + s * 0.06}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
      </g>`

    case 'panda':
      /* 熊猫：圆头 + 圆耳朵 + 眼圈 + 鼻子 */
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="${s * 0.38}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.13}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.13}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx - s * 0.13}" cy="${cy - s * 0.02}" rx="${s * 0.1}" ry="${s * 0.08}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx + s * 0.13}" cy="${cy - s * 0.02}" rx="${s * 0.1}" ry="${s * 0.08}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.13}" cy="${cy - s * 0.02}" r="${s * 0.03}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.13}" cy="${cy - s * 0.02}" r="${s * 0.03}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx}" cy="${cy + s * 0.12}" rx="${s * 0.06}" ry="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
      </g>`

    case 'unicorn':
      /* 独角兽：圆头 + 角 + 耳朵 + 眼睛 */
      return `<g>
        <ellipse cx="${cx}" cy="${cy}" rx="${s * 0.35}" ry="${s * 0.3}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx},${cy - s * 0.6} ${cx - s * 0.06},${cy - s * 0.3} ${cx + s * 0.06},${cy - s * 0.3}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx - s * 0.22},${cy - s * 0.18} ${cx - s * 0.35},${cy - s * 0.45} ${cx - s * 0.1},${cy - s * 0.28}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <polygon points="${cx + s * 0.22},${cy - s * 0.18} ${cx + s * 0.35},${cy - s * 0.45} ${cx + s * 0.1},${cy - s * 0.28}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx - s * 0.1}" cy="${cy - s * 0.02}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <circle cx="${cx + s * 0.1}" cy="${cy - s * 0.02}" r="${s * 0.04}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
        <ellipse cx="${cx}" cy="${cy + s * 0.1}" rx="${s * 0.04}" ry="${s * 0.03}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
      </g>`

    default:
      /* 默认：简单圆形 */
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.35}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`
  }
}

/**
 * 备用线稿生成器
 *
 * 使用纯SVG几何形状（不依赖emoji），确保在所有平台正确渲染轮廓
 * 每种动物/元素都有清晰的轮廓线和内部特征线（眼睛、鼻子等）
 * 内部特征线形成封闭区域，方便涂色
 */
export function getFallbackLineArt(pageType: string, index: number): string {
  const width = 800
  const height = 600

  const rng = seededRandom(index * 12345 + 67890)
  const getRandomInRange = (min: number, max: number) => rng() * (max - min) + min

  const strokeColor = '#222222'

  /* 动物类型列表，与 getFallbackIllustration 的 palette 索引对应 */
  const animalTypes = ['bunny', 'bear', 'cat', 'fox', 'panda', 'unicorn']
  const mainAnimal = animalTypes[index % animalTypes.length]

  /* 云朵轮廓 */
  const cloudOutlines = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${strokeColor}" stroke-width="2" />
  `

  /* 地面轮廓 */
  const groundOutline = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="2" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="2" />
  `

  /* 星星轮廓 — 使用确定性随机位置 */
  const starOutlines = Array.from({ length: 15 }, () => {
    const x = rng() * width
    const y = rng() * height * 0.35
    const r = getRandomInRange(6, 12)
    return `<path d="${starPath(x, y, r, r * 0.4)}" fill="none" stroke="${strokeColor}" stroke-width="1.5" />`
  }).join('')

  /* 花朵轮廓 */
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
        <line x1="0" y1="14" x2="0" y2="35" stroke="${strokeColor}" stroke-width="1.5" />
        <ellipse cx="-8" cy="28" rx="6" ry="3" fill="none" stroke="${strokeColor}" stroke-width="1" />
      </g>
    `
  }).join('')

  /* 小装饰动物 — 使用确定性随机位置 */
  const smallAnimalTypes = ['bunny', 'bear', 'cat', 'fox']
  const decorativeAnimals = Array.from({ length: 3 }, (_, i) => {
    const x = getRandomInRange(100, width - 100)
    const y = getRandomInRange(120, height * 0.5)
    const scale = getRandomInRange(50, 70)
    const type = smallAnimalTypes[(index + i) % smallAnimalTypes.length]
    return animalOutline(type, x, y, scale, strokeColor)
  }).join('')

  /* 树木轮廓 */
  const treeOutlines = Array.from({ length: 3 }, (_, i) => {
    const x = 100 + i * 250 + getRandomInRange(-30, 30)
    const y = height * 0.68
    const treeH = getRandomInRange(80, 120)
    return `<g>
      <rect x="${x - 6}" y="${y}" width="12" height="${treeH * 0.35}" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      <ellipse cx="${x}" cy="${y - treeH * 0.1}" rx="${treeH * 0.3}" ry="${treeH * 0.35}" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
    </g>`
  }).join('')

  let contentSvg = ''

  if (pageType === 'cover') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="none" stroke="${strokeColor}" stroke-width="2" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      ${animalOutline(mainAnimal, width / 2, height / 2 - 40, 100, strokeColor)}
      ${flowerOutlines}
      ${groundOutline}
    `
  } else if (pageType === 'back') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      ${decorativeAnimals}
      ${treeOutlines}
      ${flowerOutlines}
      ${groundOutline}
    `
  } else {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      ${animalOutline(mainAnimal, width / 2 - 150, height * 0.38, 80, strokeColor)}
      ${animalOutline(animalTypes[(index + 1) % animalTypes.length], width / 2 + 150, height * 0.35, 70, strokeColor)}
      ${decorativeAnimals}
      ${treeOutlines}
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
