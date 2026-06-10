/**
 * 线稿提取工具
 * 用于从彩色插画中提取线稿，确保涂色区域与原页面元素位置完全一致
 * 优化版本：使用类Canny边缘检测 + 形态学闭合，保证线条连贯
 */

/**
 * 从图片URL提取线稿
 * 使用改进的类Canny边缘检测算法 + 形态学闭合，生成连贯美观的线稿
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
        const grayscale = convertToGrayscale(data, width, height)

        // 第二步：轻度高斯模糊预处理，减少噪声但保留边缘细节
        const blurred = applyGaussianBlur(grayscale, width, height, 0.8)

        // 第三步：使用Sobel算子计算梯度幅值和方向
        const { magnitudes, directions } = calculateGradient(blurred, width, height)

        // 第四步：非最大抑制 - 使线条变细（适度处理，避免过度）
        const suppressed = nonMaximumSuppression(magnitudes, directions, width, height)

        // 第五步：双阈值检测和边缘连接 - 获得干净的边缘
        const edges = doubleThresholdAndEdgeTracking(suppressed, width, height)

        // 第六步：形态学闭合（先膨胀后腐蚀）- 连接断裂的线条
        const closed = morphologicalClosing(edges, width, height)

        // 第七步：轻度边缘细化 - 适度细化，保持线条连贯
        const thinned = thinEdgesModerately(closed, width, height)

        // 第八步：二值化处理，生成线稿
        for (let i = 0; i < width * height; i++) {
          // 边缘像素为黑色，非边缘为白色
          const isEdge = thinned[i] > 0
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
 * 将彩色图像转换为灰度图
 * @param data 图像像素数据
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 灰度图像素数组
 */
function convertToGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const grayscale = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    // 使用标准灰度转换公式：0.299*R + 0.587*G + 0.114*B
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }
  return grayscale
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
 * 使用Sobel算子计算梯度幅值和方向
 * @param grayscale 灰度图像素数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 梯度幅值数组和梯度方向数组
 */
function calculateGradient(grayscale: Float32Array, width: number, height: number): {
  magnitudes: Float32Array
  directions: Float32Array
} {
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

  const magnitudes = new Float32Array(width * height)
  const directions = new Float32Array(width * height)

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
      magnitudes[y * width + x] = magnitude

      // 计算梯度方向（弧度）
      // 将方向量化到0、45、90、135度四个方向之一
      let angle = Math.atan2(gy, gx) * 180 / Math.PI
      if (angle < 0) angle += 180
      
      // 量化到四个方向
      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        directions[y * width + x] = 0 // 水平方向
      } else if (angle >= 22.5 && angle < 67.5) {
        directions[y * width + x] = 45 // 45度方向
      } else if (angle >= 67.5 && angle < 112.5) {
        directions[y * width + x] = 90 // 垂直方向
      } else if (angle >= 112.5 && angle < 157.5) {
        directions[y * width + x] = 135 // 135度方向
      }
    }
  }

  return { magnitudes, directions }
}

/**
 * 非最大抑制
 * 使线条变细，但处理更温和，避免过度抑制导致线条断裂
 * @param magnitudes 梯度幅值数组
 * @param directions 梯度方向数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 抑制后的边缘幅值数组
 */
function nonMaximumSuppression(
  magnitudes: Float32Array,
  directions: Float32Array,
  width: number,
  height: number
): Float32Array {
  const suppressed = new Float32Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const magnitude = magnitudes[idx]
      const direction = directions[idx]

      // 如果幅值太小，直接置0
      if (magnitude < 1) {
        suppressed[idx] = 0
        continue
      }

      let neighbor1 = 0
      let neighbor2 = 0

      // 根据梯度方向比较相邻像素
      switch (direction) {
        case 0: // 水平方向边缘，比较上下像素
          neighbor1 = magnitudes[(y - 1) * width + x]
          neighbor2 = magnitudes[(y + 1) * width + x]
          break
        case 45: // 45度方向边缘，比较对角像素
          neighbor1 = magnitudes[(y - 1) * width + (x + 1)]
          neighbor2 = magnitudes[(y + 1) * width + (x - 1)]
          break
        case 90: // 垂直方向边缘，比较左右像素
          neighbor1 = magnitudes[y * width + (x - 1)]
          neighbor2 = magnitudes[y * width + (x + 1)]
          break
        case 135: // 135度方向边缘，比较对角像素
          neighbor1 = magnitudes[(y - 1) * width + (x - 1)]
          neighbor2 = magnitudes[(y + 1) * width + (x + 1)]
          break
      }

      // 只有当前像素是局部最大值时才保留
      // 使用 >= 而不是 >，确保更多边缘被保留
      if (magnitude >= neighbor1 && magnitude >= neighbor2) {
        suppressed[idx] = magnitude
      } else {
        // 不完全置0，而是降低幅值，保留弱边缘
        suppressed[idx] = magnitude * 0.3
      }
    }
  }

  return suppressed
}

/**
 * 双阈值检测和边缘连接
 * 使用较低的阈值，确保更多边缘被保留，增强线条连贯性
 * @param suppressed 非最大抑制后的边缘幅值
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 二值边缘数组（0或255）
 */
function doubleThresholdAndEdgeTracking(
  suppressed: Float32Array,
  width: number,
  height: number
): Uint8Array {
  const edges = new Uint8Array(width * height)
  
  // 找到最大幅值用于计算阈值
  let maxMagnitude = 0
  for (let i = 0; i < suppressed.length; i++) {
    if (suppressed[i] > maxMagnitude) maxMagnitude = suppressed[i]
  }

  // 设置较低的高低阈值，确保更多边缘被保留
  // 高阈值从0.25降到0.15，低阈值从0.1降到0.05
  const highThreshold = maxMagnitude * 0.12
  const lowThreshold = maxMagnitude * 0.04

  // 第一步：标记强边缘和弱边缘
  const strongEdge = 255
  const weakEdge = 128

  for (let i = 0; i < width * height; i++) {
    const magnitude = suppressed[i]
    if (magnitude >= highThreshold) {
      edges[i] = strongEdge // 强边缘
    } else if (magnitude >= lowThreshold) {
      edges[i] = weakEdge // 弱边缘
    } else {
      edges[i] = 0 // 非边缘
    }
  }

  // 第二步：边缘连接 - 只有与强边缘相连的弱边缘才保留
  // 使用迭代方法反复检查弱边缘，多迭代几次确保连接充分
  let changed = true
  let iterations = 0
  const maxIterations = 5 // 增加迭代次数，确保边缘充分连接

  while (changed && iterations < maxIterations) {
    changed = false
    iterations++
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        if (edges[idx] === weakEdge) {
          // 检查8邻域是否有强边缘
          const hasStrongNeighbor = 
            edges[(y - 1) * width + (x - 1)] === strongEdge ||
            edges[(y - 1) * width + x] === strongEdge ||
            edges[(y - 1) * width + (x + 1)] === strongEdge ||
            edges[y * width + (x - 1)] === strongEdge ||
            edges[y * width + (x + 1)] === strongEdge ||
            edges[(y + 1) * width + (x - 1)] === strongEdge ||
            edges[(y + 1) * width + x] === strongEdge ||
            edges[(y + 1) * width + (x + 1)] === strongEdge

          if (hasStrongNeighbor) {
            edges[idx] = strongEdge
            changed = true
          }
        }
      }
    }
  }

  // 第三步：对于剩余的弱边缘，如果周围有较多弱边缘也保留，增强连通性
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (edges[idx] === weakEdge) {
        // 统计8邻域内的边缘数量（强或弱）
        let neighborCount = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (ky === 0 && kx === 0) continue
            if (edges[(y + ky) * width + (x + kx)] > 0) neighborCount++
          }
        }
        // 如果周围有3个以上边缘像素，也保留
        if (neighborCount >= 3) {
          edges[idx] = strongEdge
        } else {
          edges[idx] = 0
        }
      }
    }
  }

  return edges
}

/**
 * 形态学闭合操作（先膨胀后腐蚀）
 * 用于连接断裂的线条，填充小的空隙
 * @param edges 二值边缘数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 闭合后的边缘数组
 */
function morphologicalClosing(edges: Uint8Array, width: number, height: number): Uint8Array {
  // 先膨胀
  const dilated = dilateEdges(edges, width, height)
  // 再腐蚀
  const eroded = erodeEdges(dilated, width, height)
  return eroded
}

/**
 * 膨胀操作
 * 将边缘向外扩展，连接断裂的线条
 * @param edges 二值边缘数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 膨胀后的边缘数组
 */
function dilateEdges(edges: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(edges)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (edges[idx] > 0) {
        // 将3x3邻域都设为边缘
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nidx = (y + ky) * width + (x + kx)
            result[nidx] = 255
          }
        }
      }
    }
  }

  return result
}

/**
 * 腐蚀操作
 * 将边缘向内收缩，保持线条粗细
 * @param edges 二值边缘数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 腐蚀后的边缘数组
 */
function erodeEdges(edges: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      // 只有当3x3邻域全是边缘时才保留
      let allEdges = true
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nidx = (y + ky) * width + (x + kx)
          if (edges[nidx] === 0) {
            allEdges = false
            break
          }
        }
        if (!allEdges) break
      }
      result[idx] = allEdges ? 255 : 0
    }
  }

  return result
}

/**
 * 适度的边缘细化
 * 只进行少量迭代，避免过度细化导致线条断裂
 * @param edges 二值边缘数组
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 细化后的边缘数组
 */
function thinEdgesModerately(edges: Uint8Array, width: number, height: number): Uint8Array {
  // 创建一个副本用于修改
  const thinned = new Uint8Array(edges)
  
  // 只进行2-3次迭代，适度细化，保持线条连贯
  const maxIterations = 3

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hasChanged = false

    // 第一步迭代
    const toRemove1: number[] = []
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        if (thinned[idx] === 0) continue

        // 获取8邻域像素
        const p2 = thinned[(y - 1) * width + x] > 0 ? 1 : 0
        const p3 = thinned[(y - 1) * width + (x + 1)] > 0 ? 1 : 0
        const p4 = thinned[y * width + (x + 1)] > 0 ? 1 : 0
        const p5 = thinned[(y + 1) * width + (x + 1)] > 0 ? 1 : 0
        const p6 = thinned[(y + 1) * width + x] > 0 ? 1 : 0
        const p7 = thinned[(y + 1) * width + (x - 1)] > 0 ? 1 : 0
        const p8 = thinned[y * width + (x - 1)] > 0 ? 1 : 0
        const p9 = thinned[(y - 1) * width + (x - 1)] > 0 ? 1 : 0

        // 计算条件
        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        // 放宽邻居数量限制，避免删除重要的连接点
        if (neighbors < 2 || neighbors > 7) continue

        // 计算0-1跃迁次数
        let transitions = 0
        if (p2 === 0 && p3 === 1) transitions++
        if (p3 === 0 && p4 === 1) transitions++
        if (p4 === 0 && p5 === 1) transitions++
        if (p5 === 0 && p6 === 1) transitions++
        if (p6 === 0 && p7 === 1) transitions++
        if (p7 === 0 && p8 === 1) transitions++
        if (p8 === 0 && p9 === 1) transitions++
        if (p9 === 0 && p2 === 1) transitions++
        // 放宽跃迁次数限制
        if (transitions > 2) continue

        // 第一步条件
        if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
          toRemove1.push(idx)
        }
      }
    }

    // 应用第一步删除
    for (const idx of toRemove1) {
      thinned[idx] = 0
      hasChanged = true
    }

    // 第二步迭代
    const toRemove2: number[] = []
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        if (thinned[idx] === 0) continue

        // 获取8邻域像素
        const p2 = thinned[(y - 1) * width + x] > 0 ? 1 : 0
        const p3 = thinned[(y - 1) * width + (x + 1)] > 0 ? 1 : 0
        const p4 = thinned[y * width + (x + 1)] > 0 ? 1 : 0
        const p5 = thinned[(y + 1) * width + (x + 1)] > 0 ? 1 : 0
        const p6 = thinned[(y + 1) * width + x] > 0 ? 1 : 0
        const p7 = thinned[(y + 1) * width + (x - 1)] > 0 ? 1 : 0
        const p8 = thinned[y * width + (x - 1)] > 0 ? 1 : 0
        const p9 = thinned[(y - 1) * width + (x - 1)] > 0 ? 1 : 0

        // 计算条件
        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        // 放宽邻居数量限制
        if (neighbors < 2 || neighbors > 7) continue

        // 计算0-1跃迁次数
        let transitions = 0
        if (p2 === 0 && p3 === 1) transitions++
        if (p3 === 0 && p4 === 1) transitions++
        if (p4 === 0 && p5 === 1) transitions++
        if (p5 === 0 && p6 === 1) transitions++
        if (p6 === 0 && p7 === 1) transitions++
        if (p7 === 0 && p8 === 1) transitions++
        if (p8 === 0 && p9 === 1) transitions++
        if (p9 === 0 && p2 === 1) transitions++
        // 放宽跃迁次数限制
        if (transitions > 2) continue

        // 第二步条件
        if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
          toRemove2.push(idx)
        }
      }
    }

    // 应用第二步删除
    for (const idx of toRemove2) {
      thinned[idx] = 0
      hasChanged = true
    }

    // 如果没有变化，提前退出
    if (!hasChanged) break
  }

  return thinned
}

/**
 * 获取备用线稿图（当API失败时使用）
 * 确保与备用插画使用完全相同的布局和元素位置
 * 优化线条粗细和连贯性
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
   * 使用适中的描边宽度，保证线条清晰连贯
   * @param emoji emoji字符
   * @param x x坐标
   * @param y y坐标
   * @param size 字体大小
   * @returns SVG元素字符串
   */
  const outlineEmoji = (emoji: string, x: number, y: number, size: number) => `
    <g>
      <text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.85">${emoji}</text>
    </g>
  `

  let contentSvg = ''

  // 云朵轮廓 - 位置与备用插画完全一致，线条适中
  const cloudOutlines = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.45" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.45" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.45" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.45" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.45" />
  `

  // 地面轮廓 - 位置与备用插画完全一致，线条适中
  const groundOutline = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.4" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.4" />
  `

  // 装饰元素 - 使用相同的种子确保位置一致
  const decorativeOutlines = palette.elements.map((emoji) => {
    const x = getRandomInRange(80, width - 80)
    const y = getRandomInRange(100, height * 0.55)
    const size = getRandomInRange(40, 65)
    return outlineEmoji(emoji, x, y, size)
  }).join('')

  // 星星轮廓 - 使用相同的种子确保位置一致，线条适中
  const starOutlines = Array.from({ length: 20 }, () => {
    const x = seededRandom() * width
    const y = seededRandom() * height * 0.4
    const r = getRandomInRange(2, 3.5)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.4" />`
  }).join('')

  // 花朵轮廓 - 位置与备用插画完全一致，线条适中
  const flowerOutlines = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (width - 100) / 7
    const y = height * 0.78 + Math.sin(i) * 15
    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="-10" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
        <circle cx="-8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
        <circle cx="8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
        <circle cx="-5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
        <circle cx="5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
        <circle cx="0" cy="-1" r="5" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5" />
      </g>
    `
  }).join('')

  const bigEmoji = palette.elements[0]

  // 根据页面类型生成不同的布局 - 与备用插画完全对应
  if (pageType === 'cover') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.3" />
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
      <circle cx="${width / 2 - 150}" cy="${height * 0.4}" r="60" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.3" />
      <circle cx="${width / 2 + 150}" cy="${height * 0.35}" r="50" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.25" />
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
