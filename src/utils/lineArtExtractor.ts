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

        const grayscale = new Float32Array(width * height)
        for (let i = 0; i < width * height; i++) {
          const r = data[i * 4]
          const g = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        const sobelX = [
          [-1, 0, 1],
          [-2, 0, 2],
          [-1, 0, 1],
        ]
        const sobelY = [
          [-1, -2, -1],
          [0, 0, 0],
          [1, 2, 1],
        ]

        const edges = new Float32Array(width * height)
        let maxEdge = 0

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

            const magnitude = Math.sqrt(gx * gx + gy * gy)
            edges[y * width + x] = magnitude
            if (magnitude > maxEdge) maxEdge = magnitude
          }
        }

        const threshold = maxEdge * 0.15

        for (let i = 0; i < width * height; i++) {
          const edge = edges[i]
          const isEdge = edge > threshold
          const value = isEdge ? 0 : 255

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

export function getFallbackLineArt(pageType: string, index: number): string {
  const width = 800
  const height = 600

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

  const getRandomInRange = (min: number, max: number) => Math.random() * (max - min) + min

  const outlineEmoji = (emoji: string, x: number, y: number, size: number) => `
    <g>
      <text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.3">${emoji}</text>
      <text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="${strokeColor}" opacity="0.15">${emoji}</text>
    </g>
  `

  let contentSvg = ''

  const cloudOutlines = `
    <ellipse cx="120" cy="80" rx="50" ry="25" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
    <ellipse cx="160" cy="70" rx="40" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
    <ellipse cx="180" cy="85" rx="35" ry="18" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
    <ellipse cx="650" cy="100" rx="45" ry="22" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
    <ellipse cx="690" cy="90" rx="35" ry="20" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
  `

  const groundOutline = `
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.72} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.3" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.3} ${height * 0.7}, ${width * 0.6} ${height * 0.78} T ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.3" />
  `

  const decorativeOutlines = palette.elements.map((emoji) => {
    const x = getRandomInRange(80, width - 80)
    const y = getRandomInRange(100, height * 0.55)
    const size = getRandomInRange(40, 65)
    return outlineEmoji(emoji, x, y, size)
  }).join('')

  const starOutlines = Array.from({ length: 20 }, () => {
    const x = Math.random() * width
    const y = Math.random() * height * 0.4
    const r = getRandomInRange(2, 4)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.3" />`
  }).join('')

  const flowerOutlines = Array.from({ length: 8 }, (_, i) => {
    const x = 50 + i * (width - 100) / 7
    const y = height * 0.78 + Math.sin(i) * 15
    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="-10" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
        <circle cx="-8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
        <circle cx="8" cy="-2" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
        <circle cx="-5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
        <circle cx="5" cy="6" r="8" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
        <circle cx="0" cy="-1" r="5" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" />
      </g>
    `
  }).join('')

  const bigEmoji = palette.elements[0]

  if (pageType === 'cover') {
    contentSvg = `
      ${starOutlines}
      ${cloudOutlines}
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.3" />
      <circle cx="${width / 2}" cy="${height / 2 - 40}" r="100" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.2" />
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
      <circle cx="${width / 2 - 150}" cy="${height * 0.4}" r="60" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.2" />
      <circle cx="${width / 2 + 150}" cy="${height * 0.35}" r="50" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.15" />
      ${decorativeOutlines}
      ${outlineEmoji(bigEmoji, width / 2 - 150, height * 0.4 + 20, 80)}
      ${outlineEmoji(palette.elements[1], width / 2 + 150, height * 0.38, 60)}
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
