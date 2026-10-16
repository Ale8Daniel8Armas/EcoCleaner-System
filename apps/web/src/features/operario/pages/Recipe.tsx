import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  calcularDesvio,
  calcularReceta,
  detectarIncompatibilidades,
  ErrorValidacionCore,
} from '@ecocleaner/core'
import type { NivelSuciedad } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  Card,
  Field,
  IconAlertTriangle,
  NumberStepper,
  OperarioHeader,
  PageHeader,
  Select,
  Spinner,
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
import { listarAreasDeSitio, listarSitios, listarTodasLasAreas } from '../../../services/sitios'
import { crearTarea, registrarUso } from '../../../services/tareas'
import { obtenerUsuarioActual } from '../../../services/usuarios'
import { useOperarioFlow } from '../../../context/OperarioFlowContext'

const TIEMPOS_ESTIMADOS = [15, 30, 45, 60, 90, 120]

const etiquetasCategoria: Record<string, string> = {
  acido: 'ácidos',
  alcalino: 'alcalinos',
  amoniaco: 'amoníaco',
  amonio_cuaternario: 'amonios cuaternarios',
  hipoclorito: 'hipocloritos',
  peroxido: 'peróxidos',
  solvente: 'solventes',
  otro: 'otras categorías',
}

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
  const [searchParams] = useSearchParams()
  const areaParam = searchParams.get('area')
  const { setRecetaActiva } = useOperarioFlow()

  const [sitiosList, setSitiosList] = useState<SitioOperario[]>([])
  const [productosList, setProductosList] = useState<ProductoOperario[]>([])
  const [areasDisponibles, setAreasDisponibles] = useState<AreaOperario[]>([])

  const [tipoTarea, setTipoTarea] = useState('Lavado de pisos')
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

  const [horaInicio, setHoraInicio] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [tiempoEstimadoMin, setTiempoEstimadoMin] = useState<number>(30)
  const [aguaUsada, setAguaUsada] = useState<number | ''>('')
  const [productoUsado, setProductoUsado] = useState<number | ''>('')
  const [cantidadesElegidas, setCantidadesElegidas] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState<string | null>(null)

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

        // Precarga desde QR: /operario/receta?area=<id>
        let areaObjetivo: AreaOperario | undefined
        if (areaParam) {
          const todasLasAreas = await listarTodasLasAreas()
          if (!activo) return
          areaObjetivo = todasLasAreas.find((area) => area.id === areaParam)
        }

        const sitioObjetivo =
          (areaObjetivo &&
            sitiosData.find((sitio) => sitio.id === areaObjetivo?.sitio_id)) ||
          sitiosData[0]

        if (sitioObjetivo) {
          setSitioId(sitioObjetivo.id)
          const areasData = await listarAreasDeSitio(sitioObjetivo.id)
          if (!activo) return
          setAreasDisponibles(areasData)
          const elegida =
            (areaObjetivo && areasData.find((area) => area.id === areaObjetivo?.id)) ||
            areasData[0]
          if (elegida) {
            setAreaId(elegida.id)
            setSuperficie(elegida.superficie_m2)
            setTipoSuperficie(elegida.tipo_superficie)
            setLitrosPorM2(
              elegida.litros_solucion_por_m2 ??
              operarioConfig.litrosSolucionPorM2PorDefecto,
            )
          }
        }
      },
    )
    return () => {
      activo = false
    }
  }, [areaParam])

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

  const conflictosProducto = useMemo(
    () =>
      conflictosCatalogo.filter(
        (conflicto) =>
          conflicto.producto_a_id === productoId ||
          conflicto.producto_b_id === productoId,
      ),
    [conflictosCatalogo, productoId],
  )

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
    const superficieNum = Math.max(1, Number(superficie) || 1)
    const litrosNum = Math.max(0.01, Number(litrosPorM2) || 0.4)
    try {
      const resultado = calcularReceta({
        superficie_m2: superficieNum,
        litros_solucion_por_m2: litrosNum,
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

  useEffect(() => {
    if (producto) {
      calcular()
    }
  }, [superficie, litrosPorM2, nivelSuciedad, producto])

  const puedeEnviar = useMemo(() => {
    return (
      Boolean(receta) &&
      cantidadesElegidas &&
      aguaUsada !== '' &&
      Number(aguaUsada) > 0 &&
      productoUsado !== '' &&
      Number(productoUsado) >= 0
    )
  }, [receta, cantidadesElegidas, aguaUsada, productoUsado])

  const enviarReceta = async () => {
    if (!producto || !puedeEnviar) return
    setEnviando(true)

    const superficieNum = Math.max(1, Number(superficie) || 1)
    const litrosNum = Math.max(0.01, Number(litrosPorM2) || 0.4)
    const nombreTareaFinal = tipoTarea.trim() || 'Lavado de pisos'

    let recetaParaGuardar = receta
    if (!recetaParaGuardar) {
      try {
        recetaParaGuardar = calcularReceta({
          superficie_m2: superficieNum,
          litros_solucion_por_m2: litrosNum,
          nivel_suciedad: nivelSuciedad,
          producto,
        })
        setReceta(recetaParaGuardar)
      } catch {
        setEnviando(false)
        return
      }
    }

    const usuarioActual = obtenerUsuarioActual()

    let sobredosis = false
    let desvioPct = 0
    try {
      const desvio = calcularDesvio({
        receta: recetaParaGuardar,
        litros_agua_reales: Number(aguaUsada),
        ml_producto_reales: Number(productoUsado),
        dilucion_max_ml_por_litro: producto.dilucion_max_ml_por_litro,
        tolerancia_pct: operarioConfig.toleranciaSobredosisPct,
      })
      sobredosis = Boolean(desvio.sobredosis || desvio.supera_maximo_ficha)
      desvioPct = desvio.desvio_pct
    } catch {
      // ignorar
    }

    const tarea = await crearTarea({
      area_id: areaId,
      producto_id: productoId,
      tipo_tarea: nombreTareaFinal,
      nivel_suciedad: nivelSuciedad,
      superficie_m2: superficieNum,
      litros_solucion_por_m2: litrosNum,
      receta: recetaParaGuardar,
      estado: 'receta_enviada',
      hora_inicio: horaInicio ? new Date(horaInicio).toISOString() : new Date().toISOString(),
      tiempo_estimado_min: Number(tiempoEstimadoMin),
      operario_id: usuarioActual?.id,
    })

    await registrarUso({
      tarea_id: tarea.id,
      variante_id: tarea.variante_id,
      litros_agua_reales: Number(aguaUsada),
      ml_producto_reales: Number(productoUsado),
      duracion_min: Number(tiempoEstimadoMin),
      marca: 'medido',
      fuente: 'manual',
      alerta_sobredosis: sobredosis,
      desvio_pct: desvioPct,
    })

    setConfirmacion('¡Receta enviada con éxito! La tarea ahora está en estado «receta_enviada» para revisión.')
    setTimeout(() => {
      navigate('/operario')
    }, 1200)
  }

  const rangoProducto = producto
    ? `Rango de la ficha: ${producto.dilucion_min_ml_por_litro}–${producto.dilucion_max_ml_por_litro} ml/L (recomendado ${producto.dilucion_ml_por_litro}).`
    : undefined

  return (
    <div className="operario-shell">
      <OperarioHeader
        title="Crear receta"
        backTo="/operario"
      />

      <main className="operario-main">
        <PageHeader
          eyebrow="Operario"
          title="Calcula la receta y declara su uso"
          description="Define los parámetros de limpieza, revisa la dosificación recomendada e ingresa las cantidades usadas."
        />

        {confirmacion && (
          <Alert tone="success" title="Tarea enviada">
            {confirmacion}
          </Alert>
        )}

        <Card className="operario-card">
          <p className="section-kicker">Parámetros de la tarea</p>

          <div className="form-grid">
            <Field
              id="tipo-tarea"
              label="Tipo o nombre de la tarea *"
              value={tipoTarea}
              onChange={(event) => setTipoTarea(event.target.value)}
              placeholder="Ej. Lavado de pisos, Desengrase de línea..."
              hint="Describe la actividad para identificarla en el panel."
            />
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
              hint="Baja usa dosis mínima, media recomendada y alta máxima."
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </Select>
          </div>

          <div className="form-grid" style={{ marginTop: '16px' }}>
            <Field
              id="hora-inicio"
              label="Hora de inicio *"
              type="datetime-local"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              hint="Hora de arranque de la actividad (por defecto ahora)."
            />

            <Select
              id="tiempo-estimado"
              label="Tiempo estimado *"
              value={String(tiempoEstimadoMin)}
              onChange={(e) => setTiempoEstimadoMin(Number(e.target.value))}
              hint="Duración prevista de la tarea."
            >
              {TIEMPOS_ESTIMADOS.map((min) => (
                <option key={min} value={min}>
                  {min} minutos
                </option>
              ))}
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
              error={errores.litros}
            />
          </div>
          {errorGeneral && <Alert tone="error">{errorGeneral}</Alert>}
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
                <small>Producto químico</small>
                <strong>{formatNumber(receta.ml_producto)} ml</strong>
              </div>
              <div className="result-item">
                <small>Agua</small>
                <strong>{formatNumber(receta.litros_agua)} L</strong>
              </div>
            </div>
          </Card>
        )}

        {producto && (
          <Card className="operario-card mixture-safety-card">
            <div className="mixture-safety-header">
              <div>
                <p className="section-kicker">Control preventivo de mezcla</p>
                <h3>Antes de combinar productos</h3>
                <p className="muted">
                  Esta revisión usa las incompatibilidades documentadas en el
                  catálogo y la hoja de seguridad. No autoriza mezclar productos
                  ni reemplaza la HDS.
                </p>
              </div>
              {producto.url_hoja_seguridad && (
                <a
                  className="mixture-safety-link"
                  href={producto.url_hoja_seguridad}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar HDS
                </a>
              )}
            </div>

            <div className="mixture-safety-status">
              <span className="mixture-safety-status-icon" aria-hidden="true">
                <IconAlertTriangle size={16} />
              </span>
              <div>
                <strong>Producto seleccionado: {producto.nombre}</strong>
                <span>
                  Si se incorpora otro producto, verifica su compatibilidad
                  documentada antes de preparar la mezcla.
                </span>
              </div>
            </div>

            {producto.incompatibilidades.length > 0 ? (
              <Alert tone="error" title="No mezclar con estas categorías">
                {producto.incompatibilidades
                  .map((categoria) => etiquetasCategoria[categoria] ?? categoria)
                  .join(', ')}
                . Revisa la sección 10 de la HDS antes de combinar productos.
              </Alert>
            ) : (
              <Alert tone="warning" title="Información de compatibilidad incompleta">
                El catálogo no registra categorías incompatibles para este
                producto. Esto no demuestra que una mezcla sea segura: consulta
                la HDS antes de combinarlo.
              </Alert>
            )}

            {conflictosProducto.length > 0 && (
              <div className="mixture-safety-catalog">
                <p className="mixture-safety-catalog-title">
                  Coincidencias documentadas en el catálogo
                </p>
                <ul className="incompat-list">
                  {conflictosProducto.map((conflicto) => (
                    <li
                      key={`${conflicto.producto_a_id}-${conflicto.producto_b_id}-${conflicto.categoria}`}
                    >
                      <strong>
                        {nombrePorId.get(
                          conflicto.producto_a_id === productoId
                            ? conflicto.producto_b_id
                            : conflicto.producto_a_id,
                        ) ?? 'Producto del catálogo'}
                      </strong>
                      <span>
                        Categoría incompatible: {etiquetasCategoria[conflicto.categoria] ?? conflicto.categoria}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {/* Declaración de cantidades usadas por debajo de incompatibilidades */}
        {producto && (
          <Card className="operario-card">
            <div className="card-heading">
              <div>
                <p className="section-kicker">Declaración de uso real</p>
                <h3>Cantidades usadas</h3>
                <p className="muted">
                  Declara las cantidades reales utilizadas. El botón de envío permanecerá deshabilitado hasta que selecciones o ingreses cantidades.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (receta) {
                    setAguaUsada(receta.litros_agua)
                    setProductoUsado(receta.ml_producto)
                    setCantidadesElegidas(true)
                  }
                }}
                disabled={!receta}
              >
                Usar cantidades calculadas de la receta ({receta ? `${formatNumber(receta.litros_agua)} L agua / ${formatNumber(receta.ml_producto)} ml producto` : 'Calculando...'})
              </Button>
            </div>

            <div className="stepper-grid">
              <NumberStepper
                id="agua-usada"
                label="Agua usada real"
                value={typeof aguaUsada === 'number' ? aguaUsada : 0}
                onChange={(val) => {
                  setAguaUsada(val)
                  setCantidadesElegidas(true)
                }}
                step={0.5}
                min={0}
                max={10000}
                unit="L"
              />
              <NumberStepper
                id="producto-usado"
                label="Producto químico usado"
                value={typeof productoUsado === 'number' ? productoUsado : 0}
                onChange={(val) => {
                  setProductoUsado(val)
                  setCantidadesElegidas(true)
                }}
                step={10}
                min={0}
                max={100000}
                unit="ml"
              />
            </div>

            {!cantidadesElegidas && (
              <Alert tone="warning" title="Cantidades pendientes">
                Selecciona las cantidades usadas (o pulsa «Usar cantidades calculadas») para habilitar el envío de la tarea.
              </Alert>
            )}

            <div className="operario-actions operario-actions--sticky" style={{ marginTop: '16px' }}>
              <Button
                type="button"
                onClick={enviarReceta}
                disabled={!puedeEnviar || enviando}
                aria-busy={enviando}
              >
                {enviando ? (
                  <>
                    <Spinner label="Enviando..." /> Enviando a revisión…
                  </>
                ) : (
                  'Registrar uso y enviar a revisión'
                )}
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
