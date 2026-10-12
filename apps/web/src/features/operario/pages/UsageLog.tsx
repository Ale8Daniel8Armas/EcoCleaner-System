import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { calcularDesvio } from '@ecocleaner/core'
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  PageHeader,
  Select,
} from '../../../components/ui'
import { formatNumber, formatPercent } from '../../../lib/format'
import { getProducto, operarioConfig } from '../../../services/operarioMock'
import {
  obtenerTarea,
  registrarUso,
  type TareaOperario,
} from '../../../services/tareas'

export default function UsageLog() {
  const { tareaId = '' } = useParams()
  const navigate = useNavigate()

  const [tarea, setTarea] = useState<TareaOperario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [agua, setAgua] = useState(0)
  const [producto, setProducto] = useState(0)
  const [duracion, setDuracion] = useState(operarioConfig.minutosPorDefecto)
  const [marca, setMarca] = useState<'medido' | 'estimado'>('medido')
  const [fuente, setFuente] = useState<'manual' | 'simulada' | 'sensor'>(
    'manual',
  )
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerTarea(tareaId).then((resultado) => {
      if (!activo) return
      setTarea(resultado)
      if (resultado) {
        setAgua(resultado.receta.litros_agua)
        setProducto(resultado.receta.ml_producto)
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [tareaId])

  const catalogo = tarea ? getProducto(tarea.producto_id) : undefined

  const desvio = useMemo(() => {
    if (!tarea || !catalogo) return null
    try {
      return calcularDesvio({
        receta: tarea.receta,
        litros_agua_reales: agua,
        ml_producto_reales: producto,
        dilucion_max_ml_por_litro: catalogo.dilucion_max_ml_por_litro,
        tolerancia_pct: operarioConfig.toleranciaSobredosisPct,
      })
    } catch {
      return null
    }
  }, [tarea, catalogo, agua, producto])

  const guardar = async () => {
    if (!tarea || !desvio) return
    setGuardando(true)
    const registro = await registrarUso({
      tarea_id: tarea.id,
      litros_agua_reales: agua,
      ml_producto_reales: producto,
      duracion_min: duracion,
      marca,
      fuente,
      alerta_sobredosis: desvio.sobredosis || desvio.supera_maximo_ficha,
      desvio_pct: desvio.desvio_pct,
    })
    navigate(`/operario/criterio/${registro.id}`)
  }

  if (cargando) {
    return (
      <div className="operario-shell">
        <main className="operario-main">
          <Alert tone="info" title="Cargando">
            Preparando el registro de la tarea…
          </Alert>
        </main>
      </div>
    )
  }

  if (!tarea) {
    return (
      <div className="operario-shell">
        <header className="operario-header">
          <div className="brand-lockup">
            <span className="brand-mark">EC</span>
            <div>
              <p className="eyebrow">EcoCleaner / Operario</p>
              <h1>Registro de uso</h1>
            </div>
          </div>
        </header>
        <main className="operario-main">
          <PageHeader
            eyebrow="Registro"
            title="Tarea no encontrada"
            description="No hay una receta activa para este identificador."
          />
          <Alert tone="warning" title="Sin tarea activa">
            Vuelve a calcular una receta para registrar su uso.
          </Alert>
          <div className="operario-actions">
            <Link className="ghost-button" to="/operario/receta">
              Nueva receta
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="operario-shell">
      <header className="operario-header">
        <div className="brand-lockup">
          <Link className="back-link" to="/operario/receta">
            ←
          </Link>
          <div>
            <p className="eyebrow">EcoCleaner / Operario</p>
            <h1>Registro de uso</h1>
          </div>
        </div>
        <span className="simulated-badge">
          <span className="status-dot" /> Datos simulados
        </span>
      </header>

      <main className="operario-main">
        <PageHeader
          eyebrow="Receta de referencia"
          title={`${formatNumber(tarea.receta.litros_solucion)} L · ${formatNumber(tarea.receta.ml_producto)} ml`}
          description={`Receta objetivo: ${formatNumber(tarea.receta.ml_por_litro)} ml/L de solución final.`}
        />

        <Card className="operario-card">
          <div className="stepper-grid">
            <NumberStepper
              id="agua"
              label="Agua usada"
              value={agua}
              onChange={setAgua}
              step={0.1}
              min={0}
              max={10000}
              unit="L"
            />
            <NumberStepper
              id="producto"
              label="Producto usado"
              value={producto}
              onChange={setProducto}
              step={5}
              min={0}
              max={100000}
              unit="ml"
            />
            <NumberStepper
              id="duracion"
              label="Duración"
              value={duracion}
              onChange={setDuracion}
              step={1}
              min={1}
              max={480}
              unit="min"
            />
          </div>

          <div className="form-grid">
            <Select
              label="Marca"
              value={marca}
              onChange={(event) =>
                setMarca(event.target.value as 'medido' | 'estimado')
              }
            >
              <option value="medido">Medido</option>
              <option value="estimado">Estimado</option>
            </Select>
            <Select
              label="Fuente"
              value={fuente}
              onChange={(event) =>
                setFuente(
                  event.target.value as 'manual' | 'simulada' | 'sensor',
                )
              }
            >
              <option value="manual">Manual</option>
              <option value="simulada">Simulada</option>
              <option value="sensor">Sensor</option>
            </Select>
          </div>
        </Card>

        {desvio && (
          <Card className="operario-result">
            <p className="section-kicker">Desvío frente a la receta</p>
            <div className="result-grid">
              <div className="result-item">
                <small>Concentración real</small>
                <strong>{formatNumber(desvio.ml_por_litro_real)} ml/L</strong>
              </div>
              <div className="result-item">
                <small>Receta</small>
                <strong>{formatNumber(tarea.receta.ml_por_litro)} ml/L</strong>
              </div>
              <div className="result-item">
                <small>Desvío</small>
                <strong>{formatPercent(desvio.desvio_pct)} %</strong>
              </div>
            </div>

            {desvio.supera_maximo_ficha ? (
              <Alert tone="error" title="Supera el máximo de la ficha">
                La concentración real ({formatNumber(desvio.ml_por_litro_real)}{' '}
                ml/L) excede el máximo permitido por el fabricante.
              </Alert>
            ) : desvio.sobredosis ? (
              <Alert tone="warning" title="Alerta de sobredosis">
                El desvío supera la tolerancia de{' '}
                {operarioConfig.toleranciaSobredosisPct} %. Revisa la
                dosificación antes de continuar.
              </Alert>
            ) : (
              <Alert tone="success" title="Dentro de la receta">
                La concentración real está dentro de la tolerancia configurada.
              </Alert>
            )}

            <div className="operario-actions">
              <Button type="button" onClick={guardar} disabled={guardando}>
                Guardar registro <span>→</span>
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
