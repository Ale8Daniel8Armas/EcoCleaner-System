import QRCode from 'qrcode'

/** URL pública que abre la información del área al escanear el QR. */
export function areaQrPayload(areaId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/areas/${encodeURIComponent(areaId)}`
}

/** Extrae el id de área de una URL de QR (para escaneo in-app futuro). */
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

/** Genera el QR (PNG en data URL) apuntando a la página del área. */
export async function areaQrDataUrl(
  areaId: string,
  size = 220,
): Promise<string> {
  return QRCode.toDataURL(areaQrPayload(areaId), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

/** Compone una etiqueta (nombre arriba + QR) en un PNG para descargar/imprimir. */
export async function composeLabeledQr(options: {
  qrDataUrl: string
  lines: string[]
  size?: number
}): Promise<string> {
  const { qrDataUrl, lines, size = 220 } = options
  const padding = 16
  const lineHeight = 22
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
        ? '600 14px system-ui, sans-serif'
        : '13px system-ui, sans-serif'
    ctx.fillText(line, canvas.width / 2, padding + lineHeight * (index + 1) - 6)
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

/** Abre una ventana con la etiqueta y lanza la impresión. */
export function printDataUrl(dataUrl: string, size = 220): void {
  const win = window.open('', '_blank', 'width=420,height=560')
  if (!win) return
  win.document.write(
    `<html><head><title>Etiqueta QR</title></head><body style="margin:0;display:flex;justify-content:center;align-items:flex-start;padding:12px">` +
      `<img src="${dataUrl}" style="width:${size}px" onload="window.focus();window.print();" /></body></html>`,
  )
  win.document.close()
}
