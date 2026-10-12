import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  calcularReceta,
  detectarIncompatibilidades,
  ErrorValidacionCore,
} from '@ecocleaner/core'
import type { NivelSuciedad } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  OperarioHeader,
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
import { useOperarioFlow } from '../../../context/OperarioFlowContext'
import { OPERARIO_STEPS } from '../../../context/flow'

const sitioInicial = sitios[0]
const areaInicial = getAreasDeSitio(sitioInicial.id)[0]

const nombrePorId = new Map(
  productos.map((producto) => [producto.id, producto.nombre]),
)
const CONFLICTOS_CATALOGO = (() => {
  try {
    return detectarIncompatibilidades(productos, { detallado: true }).conflictos
  } catch {
    return []
  }
})()

/** Traduce el campo del error de dominio a la clave del control. */
const campoDeError = (
  campo: string,
): 'superficie' | 'litros' | 'producto' | 'general' => {
  if (campo.startsWith('producto')) return 'producto'
  if (campo === 'superficie_m2') return 'superficie'
  if (campo === 'litros_solucion_por_m2') return 'litros'
  return 'general'
}

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
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

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
    setErrores({})
    setErrorGeneral(null)
    try {
      const resultado = calcularReceta({
        superficie_m2: superficie,
        litros_solucion_por_m2: litrosPorM2,
        nivel_suciedad: nivelSuciedad,
        producto,
      })
      setReceta(resultado)
      setRecetaActiva(resultado)
    } catch (fallo) {
      setReceta(null)
      if (fallo instanceof ErrorValidacionCore) {
        const clave = campoDeError(fallo.campo)
        if (clave === 'general') setErrorGeneral(fallo.message)
        else setErrores({ [clave]: fallo.message })
      } else {
        setErrorGeneral('No se pudo calcular la receta.')
      }
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

  const rangoProducto = producto
    ? `Rango de la ficha: ${producto.dilucion_min_ml_por_litro}–${producto.dilucion_max_ml_por_litro} ml/L (recomendado ${producto.dilucion_ml_por_litro}).`
    : undefined

  return (
    <div className="operario-shell">
      <OperarioHeader
        title="Nueva receta"
        backTo="/operario"
        breadcrumb={[
          { label: 'Operario', to: '/operario' },
          { label: 'Receta' },
        ]}
        steps={OPERARIO_STEPS}
        currentStep={0}
      />

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
              id="sitio"
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
              id="area"
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
              id="producto"
              value={productoId}
              onChange={(event) => setProductoId(event.target.value)}
              hint={rangoProducto}
              error={errores.producto}
            >
              {productos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo de superficie"
              id="tipo-superficie"
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
              id="nivel-suciedad"
              value={nivelSuciedad}
              onChange={(event) =>
                setNivelSuciedad(event.target.value as NivelSuciedad)
              }
              hint="Baja usa la dosis mínima, media la recomendada y alta la máxima."
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </Select>
          </div>

          {producto && (
            <p className="product-links">
              <a
                href={producto.url_ficha_tecnica ?? '#'}
                target="_blank"
                rel="noreferrer"
              >
                Ficha técnica
              </a>
              <a
                href={producto.url_hoja_seguridad ?? '#'}
                target="_blank"
                rel="noreferrer"
              >
                Hoja de seguridad
              </a>
            </p>
          )}

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
              error={errores.superficie}
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
              hint="Supuesto editable si el área no lo define."
              error={errores.litros}
            />
          </div>

          <div className="operario-actions operario-actions--sticky">
            <Button type="button" onClick={calcular}>
              Calcular receta
            </Button>
          </div>

          {errorGeneral && (
            <Alert tone="error" title="No se pudo calcular">
              {errorGeneral}
            </Alert>
          )}
        </Card>

        {producto && (
          <Card className="operario-card">
            <p className="section-kicker">Incompatibilidades (informativo)</p>
            {producto.incompatibilidades.length > 0 ? (
              <Alert tone="info" title="No mezclar">
                Evita mezclar {producto.nombre} con:{' '}
                {producto.incompatibilidades.join(', ')}.
              </Alert>
            ) : (
              <p className="muted">
                Sin incompatibilidades documentadas para este producto.
              </p>
            )}
            {CONFLICTOS_CATALOGO.length > 0 && (
              <ul className="incompat-list">
                {CONFLICTOS_CATALOGO.map((conflicto) => (
                  <li
                    key={`${conflicto.producto_a_id}-${conflicto.producto_b_id}-${conflicto.categoria}`}
                  >
                    {nombrePorId.get(conflicto.producto_a_id)} +{' '}
                    {nombrePorId.get(conflicto.producto_b_id)} ·{' '}
                    {conflicto.categoria}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              Datos documentados del catálogo (ficticios), solo visualización.
            </p>
          </Card>
        )}

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
            <div className="operario-actions operario-actions--sticky">
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
