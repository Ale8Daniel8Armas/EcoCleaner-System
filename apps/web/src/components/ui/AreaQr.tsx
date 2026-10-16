import { useEffect, useState } from 'react'
import { Button } from './Button'
import { Spinner } from './Spinner'
import {
  areaQrDataUrl,
  composeLabeledQr,
  downloadDataUrl,
  printDataUrl,
  qrFileName,
} from '../../lib/qr'

interface AreaQrProps {
  areaId: string
  areaNombre: string
  sitioNombre?: string
  /** Ruta relativa guardada del QR (p. ej. /areas/<id>). */
  qrPath?: string | null
  /** Tamaño en pantalla (px). */
  displaySize?: number
  /** Resolución del QR para descargar/imprimir (px). */
  exportSize?: number
  /** Ancho del QR al imprimir (mm). */
  printWidthMm?: number
  showActions?: boolean
  className?: string
}

/**
 * Etiqueta QR de un área (reubicable): muestra el QR con el nombre del sitio y
 * del área encima, y permite descargarlo (PNG) o imprimirlo en tamaño grande.
 */
export function AreaQr({
  areaId,
  areaNombre,
  sitioNombre,
  qrPath,
  displaySize = 200,
  exportSize = 512,
  printWidthMm = 95,
  showActions = true,
  className = '',
}: AreaQrProps) {
  const [qr, setQr] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let activo = true
    areaQrDataUrl(areaId, exportSize, qrPath).then((dataUrl) => {
      if (activo) setQr(dataUrl)
    })
    return () => {
      activo = false
    }
  }, [areaId, exportSize, qrPath])

  const lineas = [sitioNombre, areaNombre].filter((linea): linea is string =>
    Boolean(linea),
  )

  const componer = () =>
    qr
      ? composeLabeledQr({ qrDataUrl: qr, lines: lineas, size: exportSize })
      : Promise.resolve('')

  const descargar = async () => {
    if (!qr) return
    setOcupado(true)
    const etiqueta = await componer()
    downloadDataUrl(etiqueta, qrFileName(areaNombre, sitioNombre))
    setOcupado(false)
  }

  const imprimir = async () => {
    if (!qr) return
    setOcupado(true)
    const etiqueta = await componer()
    printDataUrl(etiqueta, printWidthMm)
    setOcupado(false)
  }

  return (
    <div className={`area-qr ${className}`.trim()}>
      <p className="area-qr-label">
        {sitioNombre && <small>{sitioNombre}</small>}
        <strong>{areaNombre}</strong>
      </p>
      <div className="area-qr-code">
        {qr ? (
          <img
            src={qr}
            alt={`QR del área ${areaNombre}`}
            width={displaySize}
            height={displaySize}
          />
        ) : (
          <Spinner />
        )}
      </div>
      {showActions && (
        <div className="area-qr-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={descargar}
            disabled={!qr || ocupado}
          >
            Descargar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={imprimir}
            disabled={!qr || ocupado}
          >
            Imprimir
          </Button>
        </div>
      )}
    </div>
  )
}
