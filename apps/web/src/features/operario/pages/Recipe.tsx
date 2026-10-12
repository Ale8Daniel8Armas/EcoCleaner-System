import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calcularReceta, ErrorValidacionCore } from '@ecocleaner/core'
import type { NivelSuciedad } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  PageHeader,
  Select,
} from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import {
  areas,
  getAreasDeSitio,
  getProducto,
  operarioConfig,
  productos,
  sitios,
  tiposSuperficie,
} from '../../../services/operarioMock'
import { crearTarea } from '../../../services/tareas'
import { useOperarioFlow } from '../context/OperarioFlowContext'

const sitioInicial = sitios[0]
const areaInicial = getAreasDeSitio(sitioInicial.id)[0]

export default function Recipe() {
  const navigate = useNavigate()
  const { setRecetaActiva } = useOperarioFlow()

  const [sitioId, setSitioId] = useState(sitioInicial.id)
  const [areaId, setAreaId] = useState(areaInicial?.id ?? '')
  const [productoId, setProductoId] = useState(productos[0].id)
  const [superficie, setSuperficie] = useState(
    areaInicial?.superficie_m2 ?? 100,
  )
  const [tipoSuperficie, setTipoSuperficie] = useState(
    areaInicial?.tipo_superficie ?? tiposSuperficie[0],
  )
  const [nivelSuciedad, setNivelSuciedad] = useState<NivelSuciedad>('media')
  const [litrosPorM2, setLitrosPorM2] = useState(
    areaInicial?.litros_solucion_por_m2 ??
      operarioConfig.litrosSolucionPorM2PorDefecto,
  )
  const [receta, setReceta] = useState<{
    litros_solucion: number
    ml_por_litro: number
    ml_producto: number
    litros_agua: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const areasDisponibles = getAreasDeSitio(sitioId)
  const producto = getProducto(productoId)

  const cambiarSitio = (id: string) => {
    setSitioId(id)
    const primera = getAreasDeSitio(id)[0]
    setAreaId(primera?.id ?? '')
    setSuperficie(primera?.superficie_m2 ?? 100)
    setTipoSuperficie(primera?.tipo_superficie ?? tiposSuperficie[0])
    setLitrosPorM2(
      primera?.litros_solucion_por_m2 ??
        operarioConfig.litrosSolucionPorM2PorDefecto,
    )
  }

  const cambiarArea = (id: string) => {
    setAreaId(id)
    const area = areas.find((item) => item.id === id)
    if (!area) return
    setSuperficie(area.superficie_m2)
    setTipoSuperficie(area.tipo_superficie)
    setLitrosPorM2(
      area.litros_solucion_por_m2 ??
        operarioConfig.litrosSolucionPorM2PorDefecto,
    )
  }

  const calcular = () => {
    if (!producto) return
    try {
      const resultado = calcularReceta({
        superficie_m2: superficie,
        litros_solucion_por_m2: litrosPorM2,
        nivel_suciedad: nivelSuciedad,
        producto,
      })
      setReceta(resultado)
      setError(null)
      setRecetaActiva(resultado)
    } catch (fallo) {
      setReceta(null)
      setError(
        fallo instanceof ErrorValidacionCore
          ? fallo.message
          : 'No se pudo calcular la receta.',
      )
    }
  }

  const registrar = async () => {
    if (!receta || !producto) return
    const tarea = await crearTarea({
      area_id: areaId,
      producto_id: productoId,
      nivel_suciedad: nivelSuciedad,
      superficie_m2: superficie,
      litros_solucion_por_m2: litrosPorM2,
      receta,
    })
    navigate(`/operario/registro/${tarea.id}`)
  }

  return (
    <div className="operario-shell">
      <header className="operario-header">
        <div className="brand-lockup">
          <span className="brand-mark">EC</span>
          <div>
            <p className="eyebrow">EcoCleaner / Operario</p>
            <h1>Nueva receta</h1>
          </div>
        </div>
        <span className="simulated-badge">
          <span className="status-dot" /> Datos simulados
        </span>
      </header>

      <main className="operario-main">
        <PageHeader
          eyebrow="Cálculo"
          title="Receta de la tarea"
          description="Elige el área y el producto; la receta respeta el rango de dilución de la ficha."
        />

        <Card className="operario-card">
          <div className="form-grid">
            <Select
              label="Sitio"
              value={sitioId}
              onChange={(event) => cambiarSitio(event.target.value)}
            >
              {sitios.map((sitio) => (
                <option key={sitio.id} value={sitio.id}>
                  {sitio.nombre}
                </option>
              ))}
            </Select>
            <Select
              label="Área"
              value={areaId}
              onChange={(event) => cambiarArea(event.target.value)}
            >
              {areasDisponibles.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nombre}
                </option>
              ))}
            </Select>
            <Select
              label="Producto"
              value={productoId}
              onChange={(event) => setProductoId(event.target.value)}
            >
              {productos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo de superficie"
              value={tipoSuperficie}
              onChange={(event) => setTipoSuperficie(event.target.value)}
            >
              {tiposSuperficie.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </Select>
            <Select
              label="Nivel de suciedad"
              value={nivelSuciedad}
              onChange={(event) =>
                setNivelSuciedad(event.target.value as NivelSuciedad)
              }
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </Select>
          </div>

          <div className="stepper-grid">
            <NumberStepper
              id="superficie"
              label="Superficie"
              value={superficie}
              onChange={setSuperficie}
              step={1}
              min={1}
              max={10000}
              unit="m²"
            />
            <NumberStepper
              id="litros-por-m2"
              label="Litros por m²"
              value={litrosPorM2}
              onChange={setLitrosPorM2}
              step={0.1}
              min={0.05}
              max={5}
              unit="L/m²"
            />
          </div>

          {producto && (
            <p className="muted">
              Rango de la ficha: {producto.dilucion_min_ml_por_litro}–
              {producto.dilucion_max_ml_por_litro} ml/L (recomendado{' '}
              {producto.dilucion_ml_por_litro}).
            </p>
          )}

          <div className="operario-actions">
            <Button type="button" onClick={calcular}>
              Calcular receta
            </Button>
          </div>

          {error && (
            <Alert tone="error" title="No se pudo calcular">
              {error}
            </Alert>
          )}
        </Card>

        {receta && (
          <Card className="operario-result">
            <p className="section-kicker">Receta calculada</p>
            <div className="result-grid">
              <div className="result-item">
                <small>Solución final</small>
                <strong>{formatNumber(receta.litros_solucion)} L</strong>
              </div>
              <div className="result-item">
                <small>Concentración</small>
                <strong>{formatNumber(receta.ml_por_litro)} ml/L</strong>
              </div>
              <div className="result-item">
                <small>Producto</small>
                <strong>{formatNumber(receta.ml_producto)} ml</strong>
              </div>
              <div className="result-item">
                <small>Agua</small>
                <strong>{formatNumber(receta.litros_agua)} L</strong>
              </div>
            </div>
            <div className="operario-actions">
              <Button type="button" onClick={registrar}>
                Registrar uso <span>→</span>
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
