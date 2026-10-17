import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Select,
  Spinner,
  IconCheck,
  SimulatedBadge,
} from '../../../components/ui';
import { formatNumber } from '../../../lib/format';
import { listarProductos } from '../../../services/productos';
import { listarSitios, listarTodasLasAreas } from '../../../services/sitios';
import { listarTareas, obtenerRegistroPorTarea, type TareaOperario } from '../../../services/tareas';
import { listarUsuarios, type Usuario } from '../../../services/usuarios';
import type { AreaOperario, ProductoOperario, SitioOperario } from '../../../services/operarioMock';
import logo from '../../../assets/ecoapp_logo.svg';

const TAREAS_POR_PAGINA = 5;

export default function RevisorHome() {

  const [tareas, setTareas] = useState<TareaOperario[]>([]);
  const [productos, setProductos] = useState<ProductoOperario[]>([]);
  const [sitios, setSitios] = useState<SitioOperario[]>([]);
  const [areas, setAreas] = useState<AreaOperario[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [simulatedTaskIds, setSimulatedTaskIds] = useState<Set<string>>(new Set());

  const [filtro, setFiltro] = useState<'pendientes' | 'completadas' | 'todas'>('pendientes');
  const [selectedArea, setSelectedArea] = useState('Todas las áreas');
  const [paginaTareas, setPaginaTareas] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const [tareasRes, prodsRes, sitiosRes, areasRes, usuariosRes] = await Promise.all([
          listarTareas(),
          listarProductos(),
          listarSitios(),
          listarTodasLasAreas(),
          listarUsuarios(),
        ]);

        if (!activo) return;
        setTareas(tareasRes);
        const registros = await Promise.all(tareasRes.map((tarea) => obtenerRegistroPorTarea(tarea.id)));
        setSimulatedTaskIds(new Set(registros.filter((registro) => registro?.fuente === 'simulada').map((registro) => registro?.tarea_id).filter(Boolean) as string[]));
        setProductos(prodsRes);
        setSitios(sitiosRes);
        setAreas(areasRes);
        setUsuarios(usuariosRes);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const productosMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const sitiosMap = useMemo(() => new Map(sitios.map((s) => [s.id, s])), [sitios]);
  const areasMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  const areasNombres = useMemo(() => {
    const nombresUnicos = new Set<string>();
    areas.forEach((a) => {
      if (a.nombre?.trim()) nombresUnicos.add(a.nombre.trim());
    });
    tareas.forEach((t) => {
      const areaObj = areasMap.get(t.area_id);
      if (areaObj?.nombre?.trim()) nombresUnicos.add(areaObj.nombre.trim());
    });
    return ['Todas las áreas', ...Array.from(nombresUnicos).sort((a, b) => a.localeCompare(b))];
  }, [areas, tareas, areasMap]);

  const tareasPendientes = useMemo(
    () => tareas.filter((t) => (t.estado ?? 'receta_enviada') !== 'completada'),
    [tareas],
  );

  const tareasCompletadas = useMemo(
    () => tareas.filter((t) => t.estado === 'completada'),
    [tareas],
  );

  // Totales acumulados para KPI
  const totales = useMemo(() => {
    return tareas.reduce(
      (acc, t) => {
        const agua = Number(t.receta?.litros_agua) || 0;
        const quimicoMl = Number(t.receta?.ml_producto) || 0;
        const superficie = Number(t.superficie_m2) || 0;
        return {
          water: acc.water + agua,
          chemicalMl: acc.chemicalMl + quimicoMl,
          surface: acc.surface + superficie,
        };
      },
      { water: 0, chemicalMl: 0, surface: 0 },
    );
  }, [tareas]);

  const formatearHora = (fechaIso?: string | null) => {
    if (!fechaIso) return 'Hora no registrada';
    try {
      const d = new Date(fechaIso);
      if (isNaN(d.getTime())) return 'Hora no registrada';
      return d.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Hora no registrada';
    }
  };

  // Filtrado de tareas
  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      const esCompletada = t.estado === 'completada';
      if (filtro === 'pendientes' && esCompletada) return false;
      if (filtro === 'completadas' && !esCompletada) return false;

      if (selectedArea !== 'Todas las áreas') {
        const areaObj = areasMap.get(t.area_id);
        if (areaObj?.nombre !== selectedArea) return false;
      }
      return true;
    });
  }, [tareas, filtro, selectedArea, areasMap]);

  useEffect(() => {
    setPaginaTareas(0);
  }, [filtro, selectedArea]);

  const tareasOrdenadas = useMemo(() => {
    return [...tareasFiltradas].sort((a, b) => {
      const fechaA = a.hora_inicio ? new Date(a.hora_inicio).getTime() : 0;
      const fechaB = b.hora_inicio ? new Date(b.hora_inicio).getTime() : 0;
      return fechaB - fechaA;
    });
  }, [tareasFiltradas]);

  const totalPaginas = Math.max(1, Math.ceil(tareasOrdenadas.length / TAREAS_POR_PAGINA));
  const paginaActual = Math.min(paginaTareas, totalPaginas - 1);
  const tareasPaginadas = tareasOrdenadas.slice(
    paginaActual * TAREAS_POR_PAGINA,
    (paginaActual + 1) * TAREAS_POR_PAGINA,
  );

  return (
    <div className="revisor-shell">
      {/* Cabecera ejecutiva del Revisor */}
      <header className="supervisor-header" style={{ marginBottom: '16px' }}>
        <div className="brand-lockup">
          <img className="brand-logo" src={logo} alt="EcoCleaner App" />
          <div>
            <p className="eyebrow" style={{ color: '#059669', fontWeight: 600 }}>EcoCleaner · Auditoría y Control de Calidad</p>
            <h1>Bandeja de documentación y dictámenes</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="revisor-pending-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#64748b'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tareasPendientes.length > 0 ? '#f59e0b' : '#10b981' }} />
            <span>
              {tareasPendientes.length > 0
                ? <><strong style={{ color: '#d97706' }}>{tareasPendientes.length}</strong> pendiente(s) por documentar</>
                : <span style={{ color: '#059669', fontWeight: 600 }}>Al día · 0 pendientes</span>}
            </span>
          </div>
        </div>
      </header>

      {/* Grid de métricas de auditoría */}
      <section className="metric-grid" aria-label="Resumen de auditoría" style={{ marginBottom: '24px' }}>
        <article className="metric-card metric-pending">
          <div className="metric-icon">◷</div>
          <p>Pendientes de dictamen</p>
          <strong>{tareasPendientes.length} <small>recetas</small></strong>
          <span className="metric-trend" style={{ color: '#d97706' }}>
            {tareasPendientes.length > 0 ? 'Requieren tu contrastación' : 'Bandeja al día'}
          </span>
        </article>

        <article className="metric-card metric-validated">
          <div className="metric-icon">✓</div>
          <p>Tareas documentadas</p>
          <strong>{tareasCompletadas.length} <small>/ {tareas.length}</small></strong>
          <span className="metric-trend" style={{ color: '#10b981' }}>
            Con dictamen completado
          </span>
        </article>

        <article className="metric-card metric-water">
          <div className="metric-icon">≈</div>
          <p>Agua auditada</p>
          <strong>{formatNumber(totales.water)} <small>L</small></strong>
          <span className="metric-trend" style={{ color: '#0284c7' }}>
            Volumen total supervisado
          </span>
        </article>

        <article className="metric-card metric-product">
          <div className="metric-icon">◌</div>
          <p>Químico supervisado</p>
          <strong>{formatNumber(totales.chemicalMl / 1000)} <small>L</small></strong>
          <span className="metric-trend" style={{ color: '#8b5cf6' }}>
            ~{formatNumber(totales.chemicalMl)} ml dosificados
          </span>
        </article>
      </section>

      {/* =========================================================================
          VISTA DESKTOP (≥ 900px): MESA DE AUDITORÍA Y TABLA EJECUTIVA
          ========================================================================= */}
      <div className="revisor-desktop-view">
        <Card className="table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
          <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Bandeja de recetas por documentar
              </h3>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: '13px' }}>
                Revisa los parámetros declarados por los operarios y emite dictámenes técnicos
              </p>
            </div>

            {/* Barra de filtros de escritorio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFiltro('pendientes')}
                  style={{
                    border: 'none',
                    background: filtro === 'pendientes' ? '#ffffff' : 'transparent',
                    color: filtro === 'pendientes' ? '#0f172a' : '#64748b',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: filtro === 'pendientes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Pendientes ({tareasPendientes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('completadas')}
                  style={{
                    border: 'none',
                    background: filtro === 'completadas' ? '#ffffff' : 'transparent',
                    color: filtro === 'completadas' ? '#0f172a' : '#64748b',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: filtro === 'completadas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Validadas ({tareasCompletadas.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('todas')}
                  style={{
                    border: 'none',
                    background: filtro === 'todas' ? '#ffffff' : 'transparent',
                    color: filtro === 'todas' ? '#0f172a' : '#64748b',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: filtro === 'todas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Todas ({tareas.length})
                </button>
              </div>

              <Select
                variant="inline"
                label=""
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                style={{ minWidth: '160px' }}
              >
                {areasNombres.map((a) => <option key={a}>{a}</option>)}
              </Select>
            </div>
          </div>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Tarea y Operario</th>
                  <th>Ubicación</th>
                  <th>Producto químico</th>
                  <th>Superficie</th>
                  <th>Nivel suciedad</th>
                  <th>Solución preparada</th>
                  <th>Hora inicio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Revisión</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                        <Spinner />
                        <span>Cargando bandeja de validación...</span>
                      </div>
                    </td>
                  </tr>
                ) : tareasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px' }}>
                      <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center', marginBottom: '4px' }}>
                          <IconCheck size={22} />
                        </div>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                          No hay tareas en esta categoría
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                          {filtro === 'pendientes'
                            ? 'Excelente trabajo: todas las recetas enviadas han sido auditadas y documentadas.'
                            : `No hay registros con filtro «${filtro}» en la selección actual.`}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tareasPaginadas.map((tarea) => {
                    const areaObj = areasMap.get(tarea.area_id);
                    const sitioObj = areaObj?.sitio_id ? sitiosMap.get(areaObj.sitio_id) : null;
                    const prod = productosMap.get(tarea.producto_id);
                    const operario = tarea.operario_id ? usuariosMap.get(tarea.operario_id) : null;
                    const nombreOperario = operario?.nombre || 'Operario';
                    const esCompletada = tarea.estado === 'completada';
                    const aguaL = Number(tarea.receta?.litros_agua) || 0;
                    const prodMl = Number(tarea.receta?.ml_producto) || 0;

                    return (
                      <tr key={tarea.id}>
                        <td>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                            {tarea.tipo_tarea || 'Lavado técnico'} {simulatedTaskIds.has(tarea.id) && <SimulatedBadge />}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                            <span style={{
                              display: 'inline-grid',
                              placeItems: 'center',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#eff6ff',
                              color: '#2563eb',
                              fontSize: '9.5px',
                              fontWeight: 700
                            }}>
                              {nombreOperario.slice(0, 1).toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {nombreOperario}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: '#1e293b', fontWeight: 500, display: 'block', fontSize: '13px' }}>
                            {areaObj?.nombre || 'Área asignada'}
                          </span>
                          <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                            {sitioObj?.nombre || 'Planta operativa'}
                          </small>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px' }}>
                            {prod?.nombre || 'Producto químico'}
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            Dosis rec: {prod?.dilucion_ml_por_litro || '—'} ml/L
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>
                            {formatNumber(tarea.superficie_m2)} m²
                          </strong>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: tarea.nivel_suciedad === 'alta' ? '#fff7ed' : tarea.nivel_suciedad === 'baja' ? '#eff6ff' : '#fefce8',
                            color: tarea.nivel_suciedad === 'alta' ? '#c2410c' : tarea.nivel_suciedad === 'baja' ? '#1d4ed8' : '#a16207',
                            border: `1px solid ${tarea.nivel_suciedad === 'alta' ? '#ffedd5' : tarea.nivel_suciedad === 'baja' ? '#dbeafe' : '#fef08a'}`
                          }}>
                            {tarea.nivel_suciedad === 'alta' ? 'Alta' : tarea.nivel_suciedad === 'baja' ? 'Baja' : 'Media'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '13px' }}>
                            {formatNumber(aguaL)} L
                          </span>
                          <span style={{ color: '#64748b', margin: '0 4px', fontSize: '12px' }}>+</span>
                          <span style={{ color: '#8b5cf6', fontWeight: 600, fontSize: '13px' }}>
                            {formatNumber(prodMl)} ml
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#475569' }}>
                            {formatearHora(tarea.hora_inicio)}
                          </span>
                        </td>
                        <td>
                          {esCompletada ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11.5px',
                              color: '#059669',
                              fontWeight: 600,
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              padding: '3px 8px',
                              borderRadius: '12px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                              Validada
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11.5px',
                              color: '#d97706',
                              fontWeight: 600,
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              padding: '3px 8px',
                              borderRadius: '12px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                              Receta enviada
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <Link
                              to={`/revisor/validar/${tarea.id}`}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                background: esCompletada ? '#ffffff' : '#059669',
                                color: esCompletada ? '#334155' : '#ffffff',
                                border: esCompletada ? '1px solid #cbd5e1' : 'none',
                                boxShadow: esCompletada ? 'none' : '0 2px 6px rgba(5, 150, 105, 0.25)'
                              }}
                            >
                              {esCompletada ? 'Ver dictamen' : 'Validar tarea'}
                            </Link>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {tareasOrdenadas.length > TAREAS_POR_PAGINA && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
            }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                Mostrando {paginaActual * TAREAS_POR_PAGINA + 1}-{Math.min((paginaActual + 1) * TAREAS_POR_PAGINA, tareasOrdenadas.length)} de {tareasOrdenadas.length} tareas
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPaginaTareas((pagina) => Math.max(0, pagina - 1))}
                  disabled={paginaActual === 0}
                  className="supervisor-header-btn"
                  style={{ height: '32px', padding: '5px 10px' }}
                >
                  Anterior
                </button>
                <span style={{ alignSelf: 'center', color: '#64748b', fontSize: '12px' }}>
                  Página {paginaActual + 1} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaTareas((pagina) => Math.min(totalPaginas - 1, pagina + 1))}
                  disabled={paginaActual === totalPaginas - 1}
                  className="supervisor-header-btn"
                  style={{ height: '32px', padding: '5px 10px' }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </Card>

      </div>

      {/* =========================================================================
          VISTA MÓVIL (< 900px): SIMPLICIDAD TÁCTIL EN BANDEJA
          ========================================================================= */}
      <div className="revisor-mobile-view">
        {/* Filtros táctiles en móvil */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setFiltro('pendientes')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: `1px solid ${filtro === 'pendientes' ? '#059669' : '#cbd5e1'}`,
              background: filtro === 'pendientes' ? '#ecfdf5' : '#ffffff',
              color: filtro === 'pendientes' ? '#059669' : '#475569',
              fontWeight: 600,
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Pendientes ({tareasPendientes.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('completadas')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: `1px solid ${filtro === 'completadas' ? '#059669' : '#cbd5e1'}`,
              background: filtro === 'completadas' ? '#ecfdf5' : '#ffffff',
              color: filtro === 'completadas' ? '#059669' : '#475569',
              fontWeight: 600,
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Validadas ({tareasCompletadas.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('todas')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: `1px solid ${filtro === 'todas' ? '#059669' : '#cbd5e1'}`,
              background: filtro === 'todas' ? '#ecfdf5' : '#ffffff',
              color: filtro === 'todas' ? '#059669' : '#475569',
              fontWeight: 600,
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Todas ({tareas.length})
          </button>
        </div>

        {/* Lista de tarjetas táctiles de revisión */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              <Spinner />
              <p style={{ marginTop: '8px', fontSize: '13px' }}>Cargando tareas por documentar…</p>
            </div>
          ) : tareasFiltradas.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '36px 16px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                Sin tareas en esta categoría
              </p>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>
                {filtro === 'pendientes'
                  ? 'No hay recetas pendientes de validación en este momento.'
                  : 'No hay registros en la vista seleccionada.'}
              </p>
            </div>
          ) : (
            tareasFiltradas.map((tarea) => {
              const areaObj = areasMap.get(tarea.area_id);
              const sitioObj = areaObj?.sitio_id ? sitiosMap.get(areaObj.sitio_id) : null;
              const prod = productosMap.get(tarea.producto_id);
              const operario = tarea.operario_id ? usuariosMap.get(tarea.operario_id) : null;
              const nombreOperario = operario?.nombre || 'Operario';
              const esCompletada = tarea.estado === 'completada';
              const aguaL = Number(tarea.receta?.litros_agua) || 0;
              const prodMl = Number(tarea.receta?.ml_producto) || 0;

              return (
                <div key={tarea.id} className="revisor-mobile-task-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {tarea.tipo_tarea || 'Lavado técnico'} {simulatedTaskIds.has(tarea.id) && <SimulatedBadge />}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#059669', fontWeight: 600 }}>
                        {prod?.nombre || 'Producto químico'}
                      </p>
                    </div>

                    <span style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: esCompletada ? '#f0fdf4' : '#fffbeb',
                      color: esCompletada ? '#059669' : '#d97706',
                      border: `1px solid ${esCompletada ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: esCompletada ? '#10b981' : '#f59e0b' }} />
                      {esCompletada ? 'Validada' : 'Pendiente'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', color: '#64748b' }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'inline-grid',
                      placeItems: 'center',
                      fontSize: '9.5px',
                      fontWeight: 700
                    }}>
                      {nombreOperario.slice(0, 1).toUpperCase()}
                    </span>
                    <span>Operario: <strong style={{ color: '#334155' }}>{nombreOperario}</strong></span>
                    <span>·</span>
                    <span>📍 {areaObj?.nombre || 'Área'}{sitioObj?.nombre ? ` · ${sitioObj.nombre}` : ''}</span>
                  </div>

                  {/* Métricas clave */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Superficie</span>
                      <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{formatNumber(tarea.superficie_m2)} m²</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Agua</span>
                      <strong style={{ fontSize: '12.5px', color: '#0284c7' }}>{formatNumber(aguaL)} L</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Químico</span>
                      <strong style={{ fontSize: '12.5px', color: '#8b5cf6' }}>{formatNumber(prodMl)} ml</strong>
                    </div>
                  </div>

                  {/* Acciones táctiles */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      to={`/revisor/validar/${tarea.id}`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        background: esCompletada ? '#ffffff' : '#059669',
                        color: esCompletada ? '#334155' : '#ffffff',
                        border: esCompletada ? '1px solid #cbd5e1' : 'none',
                        boxShadow: esCompletada ? 'none' : '0 2px 6px rgba(5, 150, 105, 0.25)'
                      }}
                    >
                      {esCompletada ? 'Ver dictamen' : 'Validar tarea →'}
                    </Link>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
