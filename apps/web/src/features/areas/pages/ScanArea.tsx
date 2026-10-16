import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Field,
  IconCamera,
  IconQr,
  SimulatedBadge,
} from '../../../components/ui'
import { parseAreaQrUrl } from '../../../lib/qr'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

const getBarcodeDetector = (): BarcodeDetectorCtor | null => {
  if (typeof window === 'undefined') return null
  const win = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return win.BarcodeDetector ?? null
}

export default function ScanArea() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const [escaneando, setEscaneando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  const detener = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setEscaneando(false)
  }

  useEffect(() => detener, [])

  const abrir = (texto: string): boolean => {
    const areaId = parseAreaQrUrl(texto)
    if (areaId) {
      detener()
      navigate(`/areas/${areaId}`)
      return true
    }
    return false
  }

  const iniciar = async () => {
    setError(null)
    const Detector = getBarcodeDetector()
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Este navegador no permite escanear dentro de la app. Usa la cámara del teléfono o pega el enlace del QR abajo.',
      )
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setEscaneando(true)
      const detector = new Detector({ formats: ['qr_code'] })
      const bucle = async () => {
        if (!videoRef.current) return
        try {
          const codigos = await detector.detect(videoRef.current)
          const valor = codigos[0]?.rawValue
          if (valor && abrir(valor)) return
        } catch {
          // fotograma no detectable; continuar
        }
        rafRef.current = requestAnimationFrame(bucle)
      }
      rafRef.current = requestAnimationFrame(bucle)
    } catch {
      setError(
        'No se pudo acceder a la cámara. Revisa los permisos del navegador o usa el enlace manual.',
      )
    }
  }

  const aplicarManual = () => {
    setError(null)
    if (!abrir(manual.trim())) {
      setError(
        'El enlace o código no corresponde a un área. Copia la URL completa del QR.',
      )
    }
  }

  return (
    <div className="area-page">
      <header className="area-page-header">
        <div className="area-brand">
          <Link className="area-back" to="/operario" aria-label="Volver">
            ←
          </Link>
          <div>
            <p className="area-page-eyebrow">EcoCleaner · Escanear</p>
            <h1 className="area-page-title">Escanear QR de área</h1>
          </div>
        </div>
        <SimulatedBadge />
      </header>

      <main className="area-page-main">
        <section className="area-card">
          <p className="area-page-eyebrow">Acceso rápido</p>
          <h2 className="area-hero-title">Apunta al QR del área</h2>
          <p className="area-muted" style={{ marginBottom: '16px' }}>
            Abre la información de limpieza de un área escaneando su etiqueta
            QR.
          </p>

          <div className="scan-video">
            <video
              ref={videoRef}
              playsInline
              muted
              className={escaneando ? 'is-active' : ''}
            />
            {!escaneando && (
              <div className="scan-video-placeholder">
                <IconQr size={48} />
                <span className="area-muted">
                  La cámara se activará al pulsar «Activar cámara».
                </span>
              </div>
            )}
          </div>

          <div className="scan-actions">
            {escaneando ? (
              <Button type="button" variant="ghost" onClick={detener}>
                Detener cámara
              </Button>
            ) : (
              <Button type="button" onClick={iniciar}>
                <IconCamera size={16} /> Activar cámara
              </Button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: '14px' }}>
              <Alert tone="warning" title="Escaneo no disponible">
                {error}
              </Alert>
            </div>
          )}
        </section>

        <section className="area-card">
          <p className="area-section-kicker">Alternativa sin cámara</p>
          <p className="area-muted" style={{ marginBottom: '14px' }}>
            Escanea el QR con la cámara del teléfono (abre el enlace) o pega
            aquí la URL de la etiqueta.
          </p>
          <Field
            id="scan-manual"
            label="Enlace o código del QR"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="https://…/areas/<id>"
            hint="También puedes escribir solo el id del área."
          />
          <div
            className="scan-actions"
            style={{ justifyContent: 'flex-start' }}
          >
            <Button
              type="button"
              onClick={aplicarManual}
              disabled={!manual.trim()}
            >
              Abrir área
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
