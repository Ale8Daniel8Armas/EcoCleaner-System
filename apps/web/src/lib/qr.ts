import QRCode from 'qrcode'

/** URL pública que abre la información del área al escanear el QR. */
export function areaQrPayload(areaId: string, qrPath?: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path =
    qrPath && qrPath.trim() ? qrPath : `/areas/${encodeURIComponent(areaId)}`
  return `${origin}${path}`
}

/** Extrae el id de área de una URL de QR (para escaneo in-app). */
export function parseAreaQrUrl(text: string): string | null {
  try {
    const url = new URL(text.trim())
    const match = url.pathname.match(/\/areas\/([^/]+)\/?$/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'area'

/** Nombre de archivo de descarga, con sitio y área para ubicarla. */
export function qrFileName(areaNombre: string, sitioNombre?: string): string {
  const base = sitioNombre
    ? `${slugify(sitioNombre)}-${slugify(areaNombre)}`
    : slugify(areaNombre)
  return `qr-${base}.png`
}

/** Genera el QR (PNG en data URL, alta resolución) apuntando a la página del área. */
export async function areaQrDataUrl(
  areaId: string,
  size = 512,
  qrPath?: string | null,
): Promise<string> {
  return QRCode.toDataURL(areaQrPayload(areaId, qrPath), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

/**
 * Compone una etiqueta (nombre arriba + QR) en un PNG grande para descargar/imprimir.
 * El padding y las fuentes escalan con el tamaño para que se vean nítidos.
 */
export async function composeLabeledQr(options: {
  qrDataUrl: string
  lines: string[]
  size?: number
}): Promise<string> {
  const { qrDataUrl, lines, size = 512 } = options
  const padding = Math.round(size * 0.08)
  const lineHeight = Math.round(size * 0.13)
  const titleFont = Math.max(16, Math.round(size * 0.08))
  const textFont = Math.max(14, Math.round(size * 0.062))
  const header = padding + lines.length * lineHeight

  const canvas = document.createElement('canvas')
  canvas.width = size + padding * 2
  canvas.height = size + header + padding
  const ctx = canvas.getContext('2d')
  if (!ctx) return qrDataUrl

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0f172a'
  lines.forEach((line, index) => {
    ctx.font =
      index === 0
        ? `700 ${titleFont}px system-ui, sans-serif`
        : `600 ${textFont}px system-ui, sans-serif`
    ctx.fillText(
      line,
      canvas.width / 2,
      padding + lineHeight * (index + 1) - Math.round(lineHeight * 0.3),
    )
  })

  const image = new Image()
  await new Promise<void>((resolve) => {
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = qrDataUrl
  })
  ctx.drawImage(image, padding, header, size, size)
  return canvas.toDataURL('image/png')
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Abre una ventana con la etiqueta a tamaño grande (mm) y lanza la impresión. */
export function printDataUrl(dataUrl: string, widthMm = 95): void {
  const win = window.open('', '_blank', 'width=560,height=720')
  if (!win) return
  win.document.write(
    `<html><head><title>Etiqueta QR</title><style>` +
      `@page { margin: 10mm; } html, body { margin: 0; }` +
      `body { display: flex; justify-content: center; align-items: flex-start; padding: 8mm; background: #ffffff; }` +
      `img { width: ${widthMm}mm; image-rendering: pixelated; }` +
      `</style></head><body><img src="${dataUrl}" onload="window.focus();window.print();" /></body></html>`,
  )
  win.document.close()
}
