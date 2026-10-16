import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { calcularReceta } from '@ecocleaner/core'
import type { NivelSuciedad } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  Card,
  Field,
  Select,
  SimulatedBadge,
} from '../../../components/ui'
import { listarProductos } from '../../../services/productos'
import { listarAreasDeSitio, listarSitios } from '../../../services/sitios'
import { crearTarea, registrarUso } from '../../../services/tareas'
import { obtenerUsuarioActual } from '../../../services/usuarios'
import type {
  AreaOperario,
  ProductoOperario,
  SitioOperario,
} from '../../../services/operarioMock'
import {
  buildSimulatedUsageRecord,
  generateSimulation,
  type SimulationReading,
  type SimulationScenario,
} from '../../../lib/simulator'

const DEMO_TICKS = 40
const isoAhora = () => new Date().toISOString()

function chartPath(readings: SimulationReading[], key: 'litrosAguaAcumulados' | 'receta') {
  if (readings.length === 0) return ''
  const max = Math.max(
    1,
    ...readings.map((reading) =>
      key === 'receta' ? readings[readings.length - 1].litrosAguaAcumulados : reading.litrosAguaAcumulados,
    ),
  )
  return readings
    .map((reading, index) => {
      const x = (index / (DEMO_TICKS - 1)) * 100
      const value = key === 'receta'
        ? readings[readings.length - 1].litrosAguaAcumulados * (index + 1) / DEMO_TICKS
        : reading.litrosAguaAcumulados
      const y = 100 - (value / max) * 88
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export default function Simulator() {
  const [sitios, setSitios] = useState<SitioOperario[]>([])
  const [areas, setAreas] = useState<AreaOperario[]>([])
  const [productos, setProductos] = useState<ProductoOperario[]>([])
  const [sitioId, setSitioId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [nivel, setNivel] = useState<NivelSuciedad>('media')
  const [tiempo, setTiempo] = useState(30)
  const [escenario, setEscenario] = useState<SimulationScenario>('normal')
  const [semilla, setSemilla] = useState(20261015)
  const [readingIndex, setReadingIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [valvulaCerrada, setValvulaCerrada] = useState(false)
  const [bombaDetenida, setBombaDetenida] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    Promise.all([listarSitios(), listarProductos()]).then(async ([sitiosData, productosData]) => {
      if (!activo) return
      setSitios(sitiosData)
      setProductos(productosData)
      setSitioId(sitiosData[0]?.id ?? '')
      setProductoId(productosData[0]?.id ?? '')
      const areasData = sitiosData[0] ? await listarAreasDeSitio(sitiosData[0].id) : []
      if (!activo) return
      setAreas(areasData)
      setAreaId(areasData[0]?.id ?? '')
    }).catch(() => {
      if (activo) setError('No se pudieron cargar sitios, áreas y productos.')
    })
    return () => { activo = false }
  }, [])

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      setReadingIndex((current) => {
        if (current >= DEMO_TICKS - 1) {
          setRunning(false)
          return current
        }
        return current + 1
      })
    }, 500)
    return () => window.clearInterval(interval)
  }, [running])

  const area = areas.find((item) => item.id === areaId)
  const producto = productos.find((item) => item.id === productoId)
  const receta = useMemo(() => {
    if (!area || !producto) return null
    try {
      return calcularReceta({
        superficie_m2: area.superficie_m2,
        litros_solucion_por_m2: area.litros_solucion_por_m2 ?? 0.4,
        nivel_suciedad: nivel,
        producto,
      })
    } catch {
      return null
    }
  }, [area, nivel, producto])

  const simulation = useMemo(() => {
    if (!receta || !producto) return null
    return generateSimulation({
      receta,
      tiempoEstimadoMin: tiempo,
      escenario,
      semilla,
      dilucionMaxMlPorLitro: producto.dilucion_max_ml_por_litro,
    })
  }, [escenario, producto, receta, semilla, tiempo])

  const readings = simulation?.readings.slice(0, readingIndex + 1) ?? []
  const current = readings[readings.length - 1]
  const finished = Boolean(simulation && readingIndex >= DEMO_TICKS - 1)

  const cambiarSitio = async (id: string) => {
    setSitioId(id)
    const areasData = await listarAreasDeSitio(id)
    setAreas(areasData)
    setAreaId(areasData[0]?.id ?? '')
  }

  const reiniciar = () => {
    setRunning(false)
    setReadingIndex(0)
    setGuardado(null)
    setError(null)
    setValvulaCerrada(false)
    setBombaDetenida(false)
  }

  const iniciar = () => {
    if (!simulation) {
      setError('Selecciona un sitio, área y producto válidos.')
      return
    }
    setError(null)
    setGuardado(null)
    setReadingIndex(0)
    setRunning(true)
  }

  const detener = () => {
    setRunning(false)
  }

  const guardar = async () => {
    if (!receta || !area || !producto || !simulation || !current) return
    setGuardando(true)
    setError(null)
    try {
      const usuario = obtenerUsuarioActual()
      const tarea = await crearTarea({
        area_id: area.id,
        producto_id: producto.id,
        tipo_tarea: 'Demostración de medición automática',
        nivel_suciedad: nivel,
        superficie_m2: area.superficie_m2,
        litros_solucion_por_m2: area.litros_solucion_por_m2 ?? 0.4,
        receta,
        estado: 'receta_enviada',
        hora_inicio: isoAhora(),
        tiempo_estimado_min: tiempo,
        operario_id: usuario?.id,
      })
      await registrarUso(buildSimulatedUsageRecord({
        tareaId: tarea.id,
        run: { ...simulation, final: current },
        duracionMin: tiempo * (current.tick / DEMO_TICKS),
      }))
      setGuardado(tarea.id)
    } catch {
      setError('No se pudo guardar la demostración. Revisa la conexión o intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const detenerYRegistrar = () => {
    detener()
    void guardar()
  }

  return (
    <div className="operario-shell simulator-page">
      <header className="operario-header">
        <div className="operario-header-top">
          <div>
            <p className="eyebrow">EcoCleaner · Herramienta de demostración</p>
            <h1>Medición automática simulada</h1>
          </div>
          <Link className="ghost-button" to="/operario">Volver al panel</Link>
        </div>
        <div className="simulator-disclaimer">
          <SimulatedBadge />
          <strong>DATOS SIMULADOS:</strong> no representan mediciones reales ni se usan como evidencia de ahorro.
        </div>
      </header>

      <main className="operario-main">
        {error && <Alert tone="error" title="No se pudo completar la operación">{error}</Alert>}
        <Card className="operario-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">Configuración de la demo</p>
              <h2>Alimenta una tarea con sensores simulados</h2>
            </div>
            <SimulatedBadge />
          </div>
          <div className="form-grid">
            <Select label="Sitio" value={sitioId} onChange={(event) => void cambiarSitio(event.target.value)}>
              {sitios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </Select>
            <Select label="Área" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
              {areas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </Select>
            <Select label="Producto" value={productoId} onChange={(event) => setProductoId(event.target.value)}>
              {productos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </Select>
            <Select label="Nivel de suciedad" value={nivel} onChange={(event) => setNivel(event.target.value as NivelSuciedad)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </Select>
            <Select label="Escenario" value={escenario} onChange={(event) => { setEscenario(event.target.value as SimulationScenario); reiniciar() }}>
              <option value="normal">Uso normal</option>
              <option value="fuga_agua">Fuga de agua</option>
              <option value="sobredosis_producto">Sobredosis de producto</option>
            </Select>
            <Field label="Duración estimada (min)" id="sim-tiempo" type="number" min={1} value={tiempo} onChange={(event) => setTiempo(Math.max(1, Number(event.target.value) || 1))} />
            <Field label="Semilla reproducible" id="sim-semilla" type="number" value={semilla} onChange={(event) => { setSemilla(Number(event.target.value) || 1); reiniciar() }} />
          </div>
          <div className="simulator-actions">
            <Button type="button" onClick={iniciar} disabled={running || !receta}>Iniciar</Button>
            <Button type="button" variant="ghost" onClick={detener} disabled={!running}>Detener</Button>
            <Button type="button" variant="ghost" onClick={reiniciar}>Reiniciar</Button>
            {escenario === 'fuga_agua' && <Button type="button" variant="ghost" onClick={() => { setValvulaCerrada(true); setRunning(false) }} disabled={valvulaCerrada}>Cerrar válvula</Button>}
            {escenario === 'sobredosis_producto' && <Button type="button" variant="ghost" onClick={() => { setBombaDetenida(true); setRunning(false) }} disabled={bombaDetenida}>Detener bomba</Button>}
          </div>
        </Card>

        <Card className="operario-card simulator-dashboard">
          <div className="card-heading">
            <div>
              <p className="section-kicker">Lecturas en vivo</p>
              <h2>{receta ? `${receta.litros_agua.toFixed(1)} L de agua objetivo` : 'Selecciona una configuración'}</h2>
            </div>
            <span className="muted">{readings.length}/{DEMO_TICKS} lecturas</span>
          </div>
          {(current || receta) && (
            <>
              <div className="simulator-metrics">
                <div><small>Caudal de agua</small><strong>{(current?.caudalAguaLMin ?? 0).toFixed(2)} L/min</strong></div>
                <div><small>Caudal de producto</small><strong>{(current?.caudalProductoMlMin ?? 0).toFixed(1)} ml/min</strong></div>
                <div><small>Agua acumulada</small><strong>{(current?.litrosAguaAcumulados ?? 0).toFixed(2)} L</strong></div>
                <div><small>Producto acumulado</small><strong>{(current?.mlProductoAcumulados ?? 0).toFixed(0)} ml</strong></div>
              </div>
              <svg className="simulator-chart" viewBox="0 0 100 100" role="img" aria-label="Agua acumulada frente a la receta">
                <path className="simulator-chart-grid" d="M0 12H100M0 34H100M0 56H100M0 78H100" />
                <path className="simulator-chart-target" d={simulation ? chartPath(simulation.readings, 'receta') : ''} />
                <path className="simulator-chart-line" d={chartPath(readings, 'litrosAguaAcumulados')} />
              </svg>
              <div className="simulator-legend"><span className="simulator-legend-live" /> Acumulado <span className="simulator-legend-target" /> Línea de receta</div>
            </>
          )}
          {current?.alertaAgua && !valvulaCerrada && <Alert tone="error" title="Posible fuga">Posible fuga: consumo {((current.litrosAguaAcumulados / (receta?.litros_agua || 1) - 1) * 100).toFixed(0)}% sobre la receta.</Alert>}
          {current?.alertaProducto && !bombaDetenida && <Alert tone="error" title="Sobredosis detectada">La bomba está inyectando producto por encima de la tolerancia.</Alert>}
          {finished && simulation && (
            <div className="simulator-finish">
              <strong>Corrida finalizada.</strong> Exceso de agua: {simulation.excesoAguaLitros.toFixed(2)} L · Desvío de producto: {simulation.desvioProductoPct.toFixed(1)}%.
              <Button type="button" onClick={detenerYRegistrar} disabled={guardando || Boolean(guardado)}>{guardando ? 'Guardando…' : guardado ? 'Registrado' : 'Detener y registrar'}</Button>
            </div>
          )}
          {!finished && current && (
            <div className="simulator-finish">
              <strong>Corrida en curso.</strong> Puedes detener y registrar la lectura acumulada hasta ahora.
              <Button type="button" onClick={detenerYRegistrar} disabled={guardando || Boolean(guardado)}>{guardando ? 'Guardando…' : 'Detener y registrar'}</Button>
            </div>
          )}
          {guardado && <Alert tone="success" title="Demostración registrada">Registro guardado con fuente «simulada». <Link to="/revisor">Ver en bandeja del revisor</Link> · <Link to="/supervisor">Ver en panel del supervisor</Link></Alert>}
        </Card>
      </main>
    </div>
  )
}
//comentario