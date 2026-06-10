/**
 * ============================================================================
 * 插画生成器 (Illustration Generator)
 * ============================================================================
 *
 * 本模块负责生成分页绘本的彩色插画。
 * Fallback模式使用确定性种子随机，与 lineArtExtractor.ts 共享同一布局算法，
 * 保证彩色插画与线稿涂色页的元素位置完全一一对应。
 */

const IMAGE_API_BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

const STYLE_SUFFIX = ', warm and cute children book illustration style, soft pastel colors, rounded shapes, gentle lines, cozy atmosphere, storybook aesthetic, hand drawn quality, whimsical and playful, dreamy lighting'

/**
 * 调色板配置 - 与 lineArtExtractor.ts 保持完全一致
 */
const PALETTES = [
  { bg1: '#FFE5EC', bg2: '#FFB6C1', accent: '#FF6B6B', elements: ['🐰', '🌸', '🌷', '🦋'] },
  { bg1: '#E8F4F8', bg2: '#B4E1E8', accent: '#7EC8A4', elements: ['🐻', '🌳', '🍄', '🌿'] },
  { bg1: '#FFF0F5', bg2: '#E6D5F0', accent: '#C4A8FF', elements: ['🐱', '⭐', '🌙', '✨'] },
  { bg1: '#F0FFF4', bg2: '#D4F1E8', accent: '#87CEEB', elements: ['🦊', '🍂', '🌻', '🌈'] },
  { bg1: '#FFF8F0', bg2: '#FFE4C9', accent: '#FF6B6B', elements: ['🐼', '🎋', '🎍', '💮'] },
  { bg1: '#F5F0FF', bg2: '#E0D5FF', accent: '#7EC8A4', elements: ['🦄', '☁️', '🌠', '🎀'] },
]

/** 画布尺寸常量 - 与 lineArtExtractor.ts 保持一致 */
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

/**
 * 基于种子的确定性伪随机数生成器 (mulberry32)
 * 与 lineArtExtractor.ts 中的实现完全相同，保证种子一致则序列一致
 */
function createSeededRandom(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 调用AI图像生成API生成插画
 * @param prompt - 插画描述提示词
 * @returns 成功返回图像blob URL，失败返回空字符串
 */
export async function generateIllustration(prompt: string): Promise<string> {
  const fullPrompt = `${prompt}${STYLE_SUFFIX}`
  const url = `${IMAGE_API_BASE}?prompt=${encodeURIComponent(fullPrompt)}&image_size=landscape_4_3`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/png, image/jpeg, image/*',
      },
    })

    if (!response.ok) throw new Error(`Image generation failed: ${response.status}`)

    const blob = await response.blob()
    if (blob.size === 0) throw new Error('Empty blob received')

    return URL.createObjectURL(blob)
  } catch (error) {
    console.warn('Image API failed, using fallback:', error)
    return ''
  }
}

/**
 * 获取Fallback彩色插画（当AI图像生成失败时使用）
 *
 * 重要：本函数使用确定性种子随机（seed = index * 1000 + 7），
 * 与 lineArtExtractor.ts 中的 generateLayout 使用完全相同的种子和算法，
 * 保证彩色插画与线稿涂色页的每个元素位置、大小完全一致。
 *
 * @param pageType - 页面类型 ('cover' | 'story' | 'back')
 * @param index - 页面索引（用于确定调色板和随机种子）
 * @returns string - SVG格式的彩色插画data URL（base64编码）
 */
export function getFallbackIllustration(pageType: string, index: number): string {
  const palette = PALETTES[index % PALETTES.length]

  // 使用与 lineArtExtractor.ts 完全相同的种子创建随机数生成器
  const rand = createSeededRandom(index * 1000 + 7)

  const getRandomInRange = (min: number, max: number) => rand() * (max - min) + min

  // 云朵（固定位置，与线稿一致）
  const cloudPaths = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="rgba(255,255,255,0.8)" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="rgba(255,255,255,0.85)" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="rgba(255,255,255,0.75)" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="rgba(255,255,255,0.8)" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="rgba(255,255,255,0.85)" />
  `

  // 草地（固定位置，与线稿一致）
  const groundPath = `
    <path d="M 0 ${CANVAS_HEIGHT * 0.7} Q ${CANVAS_WIDTH * 0.25} ${CANVAS_HEIGHT * 0.65}, ${CANVAS_WIDTH * 0.5} ${CANVAS_HEIGHT * 0.72} T ${CANVAS_WIDTH} ${CANVAS_HEIGHT * 0.7} L ${CANVAS_WIDTH} ${CANVAS_HEIGHT} L 0 ${CANVAS_HEIGHT} Z" fill="rgba(126, 200, 164, 0.3)" />
    <path d="M 0 ${CANVAS_HEIGHT * 0.75} Q ${CANVAS_WIDTH * 0.3} ${CANVAS_HEIGHT * 0.7}, ${CANVAS_WIDTH * 0.6} ${CANVAS_HEIGHT * 0.78} T ${CANVAS_WIDTH} ${CANVAS_HEIGHT * 0.75} L ${CANVAS_WIDTH} ${CANVAS_HEIGHT} L 0 ${CANVAS_HEIGHT} Z" fill="rgba(126, 200, 164, 0.5)" />
  `

  // 装饰元素（emoji）位置 - 使用确定性随机，与线稿位置一一对应
  const decorativeElements = palette.elements.map((emoji) => {
    const x = getRandomInRange(80, CANVAS_WIDTH - 80)
    const y = getRandomInRange(100, CANVAS_HEIGHT * 0.55)
    const size = getRandomInRange(40, 65)
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" opacity="0.9">${emoji}</text>`
  }).join('')

  // 星星位置 - 使用确定性随机，与线稿位置一一对应
  const stars = Array.from({ length: 20 }, () => {
    const x = rand() * CANVAS_WIDTH
    const y = rand() * CANVAS_HEIGHT * 0.4
    const r = getRandomInRange(2, 4)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255, 215, 0, 0.6)" opacity="${0.5 + rand() * 0.5}" />`
  }).join('')

  // 花朵位置 - 固定算法，与线稿一致
  const flowers = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (CANVAS_WIDTH - 100) / 7
    const y = CANVAS_HEIGHT * 0.78 + Math.sin(i) * 15
    const colors = ['#FF6B6B', '#FFD1DC', '#FFD700', '#C4A8FF', '#87CEEB']
    const color = colors[i % colors.length]
    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="-10" r="8" fill="${color}" />
        <circle cx="-8" cy="-2" r="8" fill="${color}" />
        <circle cx="8" cy="-2" r="8" fill="${color}" />
        <circle cx="-5" cy="6" r="8" fill="${color}" />
        <circle cx="5" cy="6" r="8" fill="${color}" />
        <circle cx="0" cy="-1" r="5" fill="#FFD700" />
      </g>
    `
  }).join('')

  const bigEmoji = palette.elements[0]

  // 根据页面类型组合插画内容
  let contentSvg = ''
  if (pageType === 'cover') {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      <circle cx="${CANVAS_WIDTH / 2}" cy="${CANVAS_HEIGHT / 2 - 40}" r="120" fill="${palette.bg2}" opacity="0.5" />
      <circle cx="${CANVAS_WIDTH / 2}" cy="${CANVAS_HEIGHT / 2 - 40}" r="100" fill="${palette.accent}" opacity="0.3" />
      <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT / 2 - 20}" font-size="120" text-anchor="middle">${bigEmoji}</text>
      <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT / 2 + 80}" font-size="56" font-family="'ZCOOL KuaiLe', cursive" fill="${palette.accent}" text-anchor="middle">✨ 📖 ✨</text>
      ${flowers}
      ${groundPath}
    `
  } else if (pageType === 'back') {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      ${decorativeElements}
      <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT / 2}" font-size="80" text-anchor="middle">💫</text>
      <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT / 2 + 80}" font-size="48" text-anchor="middle" fill="${palette.accent}">✨ 💝 ✨</text>
      ${flowers}
      ${groundPath}
    `
  } else {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      <circle cx="${CANVAS_WIDTH / 2 - 150}" cy="${CANVAS_HEIGHT * 0.4}" r="60" fill="${palette.bg2}" opacity="0.4" />
      <circle cx="${CANVAS_WIDTH / 2 + 150}" cy="${CANVAS_HEIGHT * 0.35}" r="50" fill="${palette.accent}" opacity="0.2" />
      ${decorativeElements}
      <text x="${CANVAS_WIDTH / 2 - 150}" y="${CANVAS_HEIGHT * 0.4 + 20}" font-size="80" text-anchor="middle">${bigEmoji}</text>
      <text x="${CANVAS_WIDTH / 2 + 150}" y="${CANVAS_HEIGHT * 0.38}" font-size="60" text-anchor="middle">${palette.elements[1]}</text>
      ${flowers}
      ${groundPath}
    `
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      <defs>
        <linearGradient id="bgGrad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${palette.bg1}" />
          <stop offset="50%" style="stop-color:${palette.bg2}" />
          <stop offset="100%" style="stop-color:${palette.bg1}" />
        </linearGradient>
        <radialGradient id="sunGrad${index}" cx="80%" cy="15%" r="30%">
          <stop offset="0%" style="stop-color:#FFE66D;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#FFE66D;stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#bgGrad${index})" />
      <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#sunGrad${index})" />
      ${contentSvg}
    </svg>
  `

  const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  return svgBase64
}
