import { useEffect, useMemo, useState } from 'react'
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
  operarioConfig,
  tiposSuperficie,
  type AreaOperario,
  type ProductoOperario,
  type SitioOperario,
} from '../../../services/operarioMock'
import { listarProductos } from '../../../services/productos'
import { listarAreasDeSitio, listarSitios } from '../../../services/sitios'
import { crearTarea } from '../../../services/tareas'
import { useOperarioFlow } from '../../../context/OperarioFlowContext'
import { OPERARIO_STEPS } from '../../../context/flow'

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

  const [sitiosList, setSitiosList] = useState<SitioOperario[]>([])
  const [productosList, setProductosList] = useState<ProductoOperario[]>([])
  const [areasDisponibles, setAreasDisponibles] = useState<AreaOperario[]>([])

  const [sitioId, setSitioId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [superficie, setSuperficie] = useState(100)
  const [tipoSuperficie, setTipoSuperficie] = useState(tiposSuperficie[0])
  const [nivelSuciedad, setNivelSuciedad] = useState<NivelSuciedad>('media')
  const [litrosPorM2, setLitrosPorM2] = useState(
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

  // Carga asíncrona inicial de sitios y productos desde la capa de servicios
  useEffect(() => {
    let activo = true
    Promise.all([listarSitios(), listarProductos()]).then(
      async ([sitiosData, productosData]) => {
        if (!activo) return
        setSitiosList(sitiosData)
        setProductosList(productosData)

        if (productosData.length > 0) {
          setProductoId(productosData[0].id)
        }

        if (sitiosData.length > 0) {
          const primerSitio = sitiosData[0]
          setSitioId(primerSitio.id)
          const areasData = await listarAreasDeSitio(primerSitio.id)
          if (!activo) return
          setAreasDisponibles(areasData)
          if (areasData.length > 0) {
            const primeraArea = areasData[0]
            setAreaId(primeraArea.id)
            setSuperficie(primeraArea.superficie_m2)
            setTipoSuperficie(primeraArea.tipo_superficie)
            setLitrosPorM2(
              primeraArea.litros_solucion_por_m2 ??
                operarioConfig.litrosSolucionPorM2PorDefecto,
            )
          }
        }
      },
    )
    return () => {
      activo = false
    }
  }, [])

  const producto = useMemo(
    () => productosList.find((p) => p.id === productoId),
    [productosList, productoId],
  )

  const nombrePorId = useMemo(
    () => new Map(productosList.map((p) => [p.id, p.nombre])),
    [productosList],
  )

  const conflictosCatalogo = useMemo(() => {
    try {
      return detectarIncompatibilidades(productosList, { detallado: true })
        .conflictos
    } catch {
      return []
    }
  }, [productosList])

  const cambiarSitio = async (id: string) => {
    setSitioId(id)
    const areasData = await listarAreasDeSitio(id)
    setAreasDisponibles(areasData)
    const primera = areasData[0]
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
    const area = areasDisponibles.find((item) => item.id === id)
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

  // Auto-cálculo para mantener sincronizada la tarjeta de receta
  useEffect(() => {
    if (producto) {
      calcular()
    }
  }, [superficie, litrosPorM2, nivelSuciedad, producto])

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
        title="Receta"
        backTo="/operario"
        breadcrumb={[{ label: 'Operario', to: '/operario' }, { label: 'Receta' }]}
        steps={OPERARIO_STEPS}
        currentStep={0}
      />

      <main className="operario-main">
        <PageHeader
          eyebrow="Paso 1 de 4"
          title="Calcula la receta"
          description="Litros de agua y ml de producto químico según superficie, litros por m² y nivel de suciedad."
        />

        <Card className="operario-card">
          <p className="section-kicker">Parámetros de la tarea</p>

          <div className="form-grid">
            <Select
              label="Sitio"
              id="sitio"
              value={sitioId}
              onChange={(event) => cambiarSitio(event.target.value)}
            >
              {sitiosList.map((sitio) => (
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
              {productosList.map((item) => (
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
            {conflictosCatalogo.length > 0 && (
              <ul className="incompat-list">
                {conflictosCatalogo.map((conflicto) => (
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
              Datos documentados del catálogo, solo visualización.
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
