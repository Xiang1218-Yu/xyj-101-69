import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { BookPage, Sticker } from '@/store/useStore'

export type PaperSize = 'a4' | 'a5' | 'letter' | 'legal'
export type PageOrientation = 'portrait' | 'landscape'
export type ImageQuality = 'low' | 'medium' | 'high' | 'ultra'

export interface ExportOptions {
  paperSize: PaperSize
  orientation: PageOrientation
  includeCover: boolean
  includeBack: boolean
  imageQuality: ImageQuality
}

export interface ExportProgress {
  current: number
  total: number
  stage: 'rendering' | 'compiling' | 'complete'
}

const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
}

const QUALITY_SETTINGS: Record<ImageQuality, { scale: number; jpegQuality: number; label: string }> = {
  low: { scale: 1, jpegQuality: 0.6, label: '低质量' },
  medium: { scale: 1.5, jpegQuality: 0.8, label: '中等' },
  high: { scale: 2, jpegQuality: 0.95, label: '高质量' },
  ultra: { scale: 3, jpegQuality: 0.98, label: '超高清' },
}

const PAPER_LABELS: Record<PaperSize, string> = {
  a4: 'A4',
  a5: 'A5',
  letter: 'Letter',
  legal: 'Legal',
}

const ORIENTATION_LABELS: Record<PageOrientation, string> = {
  portrait: '纵向',
  landscape: '横向',
}

export { PAPER_DIMENSIONS, QUALITY_SETTINGS, PAPER_LABELS, ORIENTATION_LABELS }

function renderStickers(stickers: Sticker[] = [], scale: number = 2): string {
  return stickers
    .map(
      (sticker) => `
    <div style="
      position: absolute;
      left: ${sticker.x}%;
      top: ${sticker.y}%;
      transform: translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale});
      font-size: ${48 * sticker.scale * (scale / 2)}px;
      z-index: 100;
      pointer-events: none;
    ">${sticker.emoji}</div>
  `
    )
    .join('')
}

function getCanvasDimensions(
  paperSize: PaperSize,
  orientation: PageOrientation,
  scale: number
): { width: number; height: number } {
  const dims = PAPER_DIMENSIONS[paperSize]
  const pxPerMm = 3.78 * scale
  let width = dims.width * pxPerMm
  let height = dims.height * pxPerMm
  if (orientation === 'landscape') {
    ;[width, height] = [height, width]
  }
  return { width: Math.round(width), height: Math.round(height) }
}

function estimateFileSize(
  pageCount: number,
  paperSize: PaperSize,
  orientation: PageOrientation,
  imageQuality: ImageQuality
): number {
  const { width, height } = getCanvasDimensions(paperSize, orientation, 1)
  const quality = QUALITY_SETTINGS[imageQuality]
  const pixelsPerPage = width * height * quality.scale * quality.scale
  const bytesPerPixel = 0.1 * quality.jpegQuality
  const estimatedBytes = pageCount * pixelsPerPage * bytesPerPixel
  return Math.round(estimatedBytes)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function estimateExportFileSize(
  pages: BookPage[],
  options: ExportOptions
): number {
  let pageCount = pages.length
  if (!options.includeCover) {
    pageCount -= pages.filter((p) => p.pageType === 'cover').length
  }
  if (!options.includeBack) {
    pageCount -= pages.filter((p) => p.pageType === 'back').length
  }
  return estimateFileSize(
    Math.max(1, pageCount),
    options.paperSize,
    options.orientation,
    options.imageQuality
  )
}

async function renderPageToCanvas(
  page: BookPage,
  title: string,
  index: number,
  total: number,
  language: 'zh' | 'en',
  options: ExportOptions
): Promise<string> {
  const quality = QUALITY_SETTINGS[options.imageQuality]
  const { width, height } = getCanvasDimensions(options.paperSize, options.orientation, quality.scale)

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.background = '#FFF8E7'
  container.style.fontFamily = "'ZCOOL KuaiLe', 'Nunito', sans-serif"
  container.style.overflow = 'hidden'
  container.style.padding = '0'
  container.style.margin = '0'
  document.body.appendChild(container)

  try {
    const stickersHtml = renderStickers(page.stickers || [], quality.scale)
    const scaleFactor = quality.scale / 2

    if (page.pageType === 'cover') {
      container.innerHTML = `
        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #FF6B6B 0%, #C4A8FF 50%, #7EC8A4 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden;">
          <div style="position: absolute; top: ${60 * scaleFactor}px; left: ${80 * scaleFactor}px; font-size: ${48 * scaleFactor}px; opacity: 0.6;">✨</div>
          <div style="position: absolute; top: ${100 * scaleFactor}px; right: ${100 * scaleFactor}px; font-size: ${60 * scaleFactor}px; opacity: 0.5;">⭐</div>
          <div style="position: absolute; bottom: ${120 * scaleFactor}px; left: ${100 * scaleFactor}px; font-size: ${42 * scaleFactor}px; opacity: 0.4;">💫</div>
          <div style="position: absolute; bottom: ${80 * scaleFactor}px; right: ${120 * scaleFactor}px; font-size: ${52 * scaleFactor}px; opacity: 0.5;">🪐</div>
          <div style="background: rgba(255,255,255,0.95); border-radius: ${24 * scaleFactor}px; padding: ${60 * scaleFactor}px ${80 * scaleFactor}px; text-align: center; box-shadow: 0 ${20 * scaleFactor}px ${60 * scaleFactor}px rgba(0,0,0,0.15); max-width: ${700 * scaleFactor}px;">
            <div style="font-size: ${80 * scaleFactor}px; margin-bottom: ${24 * scaleFactor}px;">📖</div>
            <h1 style="font-size: ${52 * scaleFactor}px; color: #3d3d3d; margin: 0 0 ${20 * scaleFactor}px 0; font-family: 'ZCOOL KuaiLe', cursive; line-height: 1.2;">${title}</h1>
            <p style="font-size: ${22 * scaleFactor}px; color: #8B6F47; margin: 0; font-family: 'Nunito', sans-serif;">${language === 'zh' ? '✨ 故事星球 出品 ✨' : '✨ By Story Planet ✨'}</p>
          </div>
          ${stickersHtml}
        </div>
      `
    } else if (page.pageType === 'back') {
      container.innerHTML = `
        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #7EC8A4 0%, #87CEEB 50%, #C4A8FF 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden;">
          <div style="position: absolute; top: ${80 * scaleFactor}px; left: ${100 * scaleFactor}px; font-size: ${56 * scaleFactor}px;">✨</div>
          <div style="position: absolute; top: ${100 * scaleFactor}px; right: ${120 * scaleFactor}px; font-size: ${48 * scaleFactor}px;">⭐</div>
          <div style="position: absolute; bottom: ${150 * scaleFactor}px; left: ${120 * scaleFactor}px; font-size: ${44 * scaleFactor}px;">💫</div>
          <div style="position: absolute; bottom: ${100 * scaleFactor}px; right: ${100 * scaleFactor}px; font-size: ${52 * scaleFactor}px;">🌟</div>
          <div style="background: rgba(255,255,255,0.95); border-radius: ${24 * scaleFactor}px; padding: ${60 * scaleFactor}px ${80 * scaleFactor}px; text-align: center; box-shadow: 0 ${20 * scaleFactor}px ${60 * scaleFactor}px rgba(0,0,0,0.15); max-width: ${700 * scaleFactor}px;">
            <div style="font-size: ${72 * scaleFactor}px; margin-bottom: ${24 * scaleFactor}px;">💝</div>
            <p style="font-size: ${30 * scaleFactor}px; color: #3d3d3d; margin: 0 0 ${16 * scaleFactor}px 0; font-family: 'ZCOOL KuaiLe', cursive; line-height: 1.6;">${page.text}</p>
            <p style="font-size: ${20 * scaleFactor}px; color: #8B6F47; margin: 0; font-family: 'Nunito', sans-serif;">${language === 'zh' ? '✨ 故事星球 - 每个孩子都是故事的主角 ✨' : '✨ Story Planet - Every child is the star ✨'}</p>
          </div>
          ${stickersHtml}
        </div>
      `
    } else {
      const imgHtml = page.illustrationUrl
        ? `<img src="${page.illustrationUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" crossorigin="anonymous" />`
        : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #FFD1DC 0%, #C4A8FF 50%, #87CEEB 100%); display: flex; align-items: center; justify-content: center;"><span style="font-size: ${120 * scaleFactor}px;">🎨</span></div>`

      container.innerHTML = `
        <div style="width: 100%; height: 100%; background: #FFF8E7; display: flex; flex-direction: column; overflow: hidden; position: relative;">
          <div style="height: 65%; width: 100%; overflow: hidden; position: relative;">
            ${imgHtml}
          </div>
          <div style="height: 35%; width: 100%; background: #FFF8E7; padding: ${40 * scaleFactor}px ${60 * scaleFactor}px; display: flex; flex-direction: column; justify-content: center; position: relative; box-sizing: border-box;">
            <p style="font-size: ${28 * scaleFactor}px; color: #3d3d3d; margin: 0; text-align: center; line-height: 1.6; font-family: 'Nunito', sans-serif; font-weight: 600;">${page.text}</p>
            <span style="position: absolute; bottom: ${20 * scaleFactor}px; right: ${40 * scaleFactor}px; font-size: ${16 * scaleFactor}px; color: rgba(139, 111, 71, 0.4); font-family: 'Nunito', sans-serif;">${index} / ${total}</span>
          </div>
          ${stickersHtml}
        </div>
      `
    }

    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      logging: false,
    })

    return canvas.toDataURL('image/jpeg', quality.jpegQuality)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportBookToPDF(
  pages: BookPage[],
  title: string,
  language: 'zh' | 'en',
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  let filteredPages = pages
  if (!options.includeCover) {
    filteredPages = filteredPages.filter((p) => p.pageType !== 'cover')
  }
  if (!options.includeBack) {
    filteredPages = filteredPages.filter((p) => p.pageType !== 'back')
  }

  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.paperSize,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const total = filteredPages.length

  for (let i = 0; i < total; i++) {
    if (i > 0) pdf.addPage()

    const page = filteredPages[i]
    const dataUrl = await renderPageToCanvas(page, title, i + 1, total, language, options)

    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)

    onProgress?.({
      current: i + 1,
      total,
      stage: i === total - 1 ? 'compiling' : 'rendering',
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  onProgress?.({
    current: total,
    total,
    stage: 'complete',
  })

  pdf.save(`${title}.pdf`)
}
