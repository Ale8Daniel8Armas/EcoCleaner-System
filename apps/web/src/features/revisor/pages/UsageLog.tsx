import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { calcularDesvio } from '@ecocleaner/core'
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  OperarioHeader,
  PageHeader,
  Select,
  Spinner,
} from '../../../components/ui'
import { formatNumber, formatPercent } from '../../../lib/format'
import { operarioConfig, type ProductoOperario } from '../../../services/operarioMock'
import { obtenerProducto } from '../../../services/productos'
import {
  obtenerTarea,
  registrarUso,
  type TareaOperario,
} from '../../../services/tareas'
import { OPERARIO_STEPS } from '../../../context/flow'

export default function UsageLog() {
  const { tareaId = '' } = useParams()
  const navigate = useNavigate()

  const [tarea, setTarea] = useState<TareaOperario | null>(null)
  const [catalogo, setCatalogo] = useState<ProductoOperario | null>(null)
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
    obtenerTarea(tareaId).then(async (resultado) => {
      if (!activo) return
      setTarea(resultado)
      if (resultado) {
        setAgua(resultado.receta.litros_agua)
        setProducto(resultado.receta.ml_producto)
        const prod = await obtenerProducto(resultado.producto_id)
        if (!activo) return
        setCatalogo(prod ?? null)
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [tareaId])

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
    const aguaNum = Number(agua)
    const prodNum = Number(producto)
    const durNum = Number(duracion)

    const registro = await registrarUso({
      tarea_id: tarea.id,
      litros_agua_reales: aguaNum,
      ml_producto_reales: prodNum,
      duracion_min: durNum,
      marca,
      fuente,
      alerta_sobredosis: desvio.sobredosis || desvio.supera_maximo_ficha,
      desvio_pct: desvio.desvio_pct,
    })
    navigate(`/operario/criterio/${registro.id}`)
  }

  if (cargando) {
    return (
      <div className="revisor-shell">
        <main className="operario-main">
          <Card className="operario-card">
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando la tarea…</span>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  if (!tarea) {
    return (
      <div className="revisor-shell">
        <OperarioHeader
          eyebrow="EcoCleaner · Auditoría y Revisión"
          title="Registro de uso"
          backTo="/revisor"
          breadcrumb={[
            { label: 'Revisor', to: '/revisor' },
            { label: 'Registro' },
          ]}
          steps={OPERARIO_STEPS}
          currentStep={1}
        />
        <main className="operario-main">
          <PageHeader
            eyebrow="Registro"
            title="Tarea no encontrada"
            description="No hay una receta activa para este identificador."
          />
          <Alert tone="warning" title="Sin tarea activa">
            Vuelve a la bandeja de revisor para seleccionar una tarea.
          </Alert>
          <div className="operario-actions">
            <Link className="ghost-button" to="/revisor">
              Volver a la bandeja
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="revisor-shell">
      <OperarioHeader
        eyebrow="EcoCleaner · Auditoría y Revisión"
        title="Registro de uso"
        backTo="/revisor"
        breadcrumb={[
          { label: 'Revisor', to: '/revisor' },
          { label: 'Registro' },
        ]}
        steps={OPERARIO_STEPS}
        currentStep={1}
      />

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
              id="marca"
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
              id="fuente"
              value={fuente}
              onChange={(event) =>
                setFuente(
                  event.target.value as 'manual' | 'simulada' | 'sensor',
                )
              }
              hint="Los datos simulados se rotulan y no cuentan como evidencia de ahorro."
            >
              <option value="manual">Manual</option>
              <option value="simulada">Simulada</option>
              <option value="sensor">Sensor</option>
            </Select>
          </div>
        </Card>

        {desvio ? (
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

            <div className="operario-actions operario-actions--sticky">
              <Button
                type="button"
                onClick={guardar}
                disabled={guardando}
                aria-busy={guardando}
              >
                {guardando ? (
                  <>
                    <Spinner label="Guardando registro" /> Guardando…
                  </>
                ) : (
                  <>
                    Guardar registro <span>→</span>
                  </>
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <Alert tone="info" title="Aún no se puede calcular el desvío">
            Ajusta el agua y el producto usados para ver el desvío frente a la
            receta.
          </Alert>
        )}
      </main>
    </div>
  )
}
