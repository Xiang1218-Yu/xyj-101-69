const IMAGE_API_BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

const STYLE_SUFFIX = ', warm and cute children book illustration style, soft pastel colors, rounded shapes, gentle lines, cozy atmosphere, storybook aesthetic, hand drawn quality, whimsical and playful, dreamy lighting'

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

export function getFallbackIllustration(pageType: string, index: number): string {
  const width = 800
  const height = 600

  const palettes = [
    { bg1: '#FFE5EC', bg2: '#FFB6C1', accent: '#FF6B6B', elements: ['🐰', '🌸', '🌷', '🦋'] },
    { bg1: '#E8F4F8', bg2: '#B4E1E8', accent: '#7EC8A4', elements: ['🐻', '🌳', '🍄', '🌿'] },
    { bg1: '#FFF0F5', bg2: '#E6D5F0', accent: '#C4A8FF', elements: ['🐱', '⭐', '🌙', '✨'] },
    { bg1: '#F0FFF4', bg2: '#D4F1E8', accent: '#87CEEB', elements: ['🦊', '🍂', '🌻', '🌈'] },
    { bg1: '#FFF8F0', bg2: '#FFE4C9', accent: '#FF6B6B', elements: ['🐼', '🎋', '🎍', '💮'] },
    { bg1: '#F5F0FF', bg2: '#E0D5FF', accent: '#7EC8A4', elements: ['🦄', '☁️', '🌠', '🎀'] },
  ]

  const palette = palettes[index % palettes.length]

  const getRandomInRange = (min: number, max: number) => Math.random() * (max - min) + min

  let contentSvg = ''

  const cloudPaths = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="rgba(255,255,255,0.8)" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="rgba(255,255,255,0.85)" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="rgba(255,255,255,0.75)" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="rgba(255,255,255,0.8)" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="rgba(255,255,255,0.85)" />
  `

  const groundPath = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="rgba(126, 200, 164, 0.3)" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="rgba(126, 200, 164, 0.5)" />
  `

  const decorativeElements = palette.elements.map((emoji, i) => {
    const x = getRandomInRange(80, width - 80)
    const y = getRandomInRange(100, height * 0.55)
    const size = getRandomInRange(40, 65)
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" opacity="0.9">${emoji}</text>`
  }).join('')

  const stars = Array.from({ length: 20 }, (_, i) => {
    const x = Math.random() * width
    const y = Math.random() * height * 0.4
    const r = getRandomInRange(2, 4)
    const delay = Math.random() * 3
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255, 215, 0, 0.6)" opacity="${0.5 + Math.random() * 0.5}" />`
  }).join('')

  const flowers = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (width - 100) / 7
    const y = height * 0.78 + Math.sin(i) * 15
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

  if (pageType === 'cover') {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="${palette.bg2}" opacity="0.5" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="${palette.accent}" opacity="0.3" />
      <text x="${width / 2}" y="${height / 2 - 20}" font-size="120" text-anchor="middle">${bigEmoji}</text>
      <text x="${width / 2}" y="${height / 2 + 80}" font-size="56" font-family="'ZCOOL KuaiLe', cursive" fill="${palette.accent}" text-anchor="middle">✨ 📖 ✨</text>
      ${flowers}
      ${groundPath}
    `
  } else if (pageType === 'back') {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      ${decorativeElements}
      <text x="${width / 2}" y="${height / 2}" font-size="80" text-anchor="middle">💫</text>
      <text x="${width / 2}" y="${height / 2 + 80}" font-size="48" text-anchor="middle" fill="${palette.accent}">✨ 💝 ✨</text>
      ${flowers}
      ${groundPath}
    `
  } else {
    contentSvg = `
      ${stars}
      ${cloudPaths}
      <circle cx="${width / 2 - 150}" cy="${height * 0.4}" r="60" fill="${palette.bg2}" opacity="0.4" />
      <circle cx="${width / 2 + 150}" cy="${height * 0.35}" r="50" fill="${palette.accent}" opacity="0.2" />
      ${decorativeElements}
      <text x="${width / 2 - 150}" y="${height * 0.4 + 20}" font-size="80" text-anchor="middle">${bigEmoji}</text>
      <text x="${width / 2 + 150}" y="${height * 0.38}" font-size="60" text-anchor="middle">${palette.elements[1]}</text>
      ${flowers}
      ${groundPath}
    `
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
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
      <rect width="${width}" height="${height}" fill="url(#bgGrad${index})" />
      <rect width="${width}" height="${height}" fill="url(#sunGrad${index})" />
      ${contentSvg}
    </svg>
  `

  const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  return svgBase64
}
