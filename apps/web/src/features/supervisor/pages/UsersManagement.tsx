import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Card,
    IconArrowLeft,
    IconPlus,
    IconUsers,
    IconCheck,
    IconAlertTriangle,
} from '../../../components/ui';
import {
    listarUsuarios,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    type Usuario,
    type RolUsuario,
} from '../../../services/usuarios';

const formatearFecha = (fechaIso?: string | null) => {
    if (!fechaIso) return '—';
    try {
        const d = new Date(fechaIso);
        return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(fechaIso);
    }
};

export default function UsersManagement() {
    const [usuariosList, setUsuariosList] = useState<Usuario[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroRol, setFiltroRol] = useState<'todos' | 'operario' | 'revisor' | 'supervisor'>('todos');

    // Estado Modal Crear Usuario
    const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
    const [crearNombre, setCrearNombre] = useState('');
    const [crearUsername, setCrearUsername] = useState('');
    const [crearEmail, setCrearEmail] = useState('');
    const [crearPassword, setCrearPassword] = useState('');
    const [crearRol, setCrearRol] = useState<RolUsuario>('operario');
    const [guardandoCrear, setGuardandoCrear] = useState(false);
    const [mensajeCrear, setMensajeCrear] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    // Estado Modal Editar Usuario
    const [usuarioParaEditar, setUsuarioParaEditar] = useState<Usuario | null>(null);
    const [editNombre, setEditNombre] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editRol, setEditRol] = useState<RolUsuario>('operario');
    const [guardandoEditar, setGuardandoEditar] = useState(false);
    const [mensajeEditar, setMensajeEditar] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    // Estado Modal Eliminar Usuario
    const [usuarioParaEliminar, setUsuarioParaEliminar] = useState<Usuario | null>(null);
    const [eliminandoUsuario, setEliminandoUsuario] = useState(false);
    const [mensajeEliminar, setMensajeEliminar] = useState<string | null>(null);

    // Toast flotante
    const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const mostrarToast = (tipo: 'ok' | 'error', texto: string) => {
        setToast({ tipo, texto });
        setTimeout(() => setToast(null), 4000);
    };

    const cargarUsuarios = async () => {
        try {
            setCargando(true);
            const list = await listarUsuarios();
            setUsuariosList(list);
        } catch (err) {
            console.error('Error al cargar usuarios:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarUsuarios();
    }, []);

    // Conteo por roles
    const operariosCount = useMemo(() => usuariosList.filter((u) => u.rol === 'operario').length, [usuariosList]);
    const revisoresCount = useMemo(() => usuariosList.filter((u) => u.rol === 'revisor').length, [usuariosList]);
    const supervisoresCount = useMemo(() => usuariosList.filter((u) => u.rol === 'supervisor').length, [usuariosList]);

    // Filtrado dinámico
    const usuariosFiltrados = useMemo(() => {
        return usuariosList.filter((u) => {
            const coincideRol = filtroRol === 'todos' || u.rol === filtroRol;
            if (!coincideRol) return false;

            if (!busqueda.trim()) return true;
            const q = busqueda.toLowerCase().trim();
            return (
                u.nombre.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.rol.toLowerCase().includes(q)
            );
        });
    }, [usuariosList, filtroRol, busqueda]);

    // 1. Manejo Crear Usuario
    const handleCrearUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        setGuardandoCrear(true);
        setMensajeCrear(null);

        const res = await crearUsuario(
            {
                nombre: crearNombre,
                username: crearUsername,
                email: crearEmail,
                password: crearPassword,
                rol: crearRol,
            },
            false,
        );

        setGuardandoCrear(false);

        if (res.ok && res.usuario) {
            setModalCrearAbierto(false);
            setCrearNombre('');
            setCrearUsername('');
            setCrearEmail('');
            setCrearPassword('');
            setCrearRol('operario');
            await cargarUsuarios();
            mostrarToast('ok', `Usuario «${res.usuario.nombre}» creado con perfil ${res.usuario.rol.toUpperCase()}.`);
        } else {
            setMensajeCrear({
                tipo: 'error',
                texto: res.error || 'No se pudo crear el usuario. Revisa los datos ingresados.',
            });
        }
    };

    // 2. Manejo Editar Usuario
    const abrirModalEditar = (u: Usuario) => {
        setUsuarioParaEditar(u);
        setEditNombre(u.nombre);
        setEditUsername(u.username);
        setEditEmail(u.email);
        setEditPassword('');
        setEditRol(u.rol);
        setMensajeEditar(null);
    };

    const handleActualizarUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!usuarioParaEditar) return;

        setGuardandoEditar(true);
        setMensajeEditar(null);

        const res = await actualizarUsuario(usuarioParaEditar.id, {
            nombre: editNombre,
            username: editUsername,
            email: editEmail,
            rol: editRol,
            password: editPassword.trim() ? editPassword : undefined,
        });

        setGuardandoEditar(false);

        if (res.ok) {
            setUsuarioParaEditar(null);
            await cargarUsuarios();
            mostrarToast('ok', `Usuario «${editNombre}» actualizado exitosamente.`);
        } else {
            setMensajeEditar({
                tipo: 'error',
                texto: res.error || 'No se pudo actualizar el usuario. Intenta nuevamente.',
            });
        }
    };

    // 3. Manejo Eliminar Usuario
    const abrirModalEliminar = (u: Usuario) => {
        setUsuarioParaEliminar(u);
        setMensajeEliminar(null);
    };

    const handleConfirmarEliminar = async () => {
        if (!usuarioParaEliminar) return;

        setEliminandoUsuario(true);
        setMensajeEliminar(null);

        const res = await eliminarUsuario(usuarioParaEliminar.id);

        setEliminandoUsuario(false);

        if (res.ok) {
            const nombreEliminado = usuarioParaEliminar.nombre;
            setUsuarioParaEliminar(null);
            await cargarUsuarios();
            mostrarToast('ok', `Usuario «${nombreEliminado}» eliminado del sistema.`);
        } else {
            setMensajeEliminar(res.error || 'No se pudo eliminar el usuario.');
        }
    };

    return (
        <div className="supervisor-shell report-page">
            {/* Header del Módulo de Usuarios */}
            <header className="supervisor-header report-header-bar">
                <div className="brand-lockup">
                    <Link className="supervisor-header-btn" to="/supervisor" title="Volver al panel principal">
                        <IconArrowLeft size={16} />
                        <span>Volver al panel</span>
                    </Link>
                    <div>
                        <p className="eyebrow">EcoCleaner · Seguridad y Control de Acceso</p>
                        <h1>Gestión de usuarios y perfiles</h1>
                    </div>
                </div>
                <div className="report-header-actions">
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                            setModalCrearAbierto(true);
                            setMensajeCrear(null);
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            height: '36px',
                            padding: '0 16px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <IconPlus size={15} />
                        <span>Registrar nuevo usuario</span>
                    </button>
                </div>
            </header>

            <main className="report-main" style={{ maxWidth: '1080px', margin: '24px auto' }}>
                {/* Metadatos consolidados del directorio */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">TOTAL COLABORADORES</span>
                            <strong className="report-meta-val">{usuariosList.length} registrados</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">OPERARIOS ACTIVOS</span>
                            <strong className="report-meta-val" style={{ color: '#0284c7' }}>{operariosCount} operario(s)</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">REVISORES ACTIVOS</span>
                            <strong className="report-meta-val" style={{ color: '#7c3aed' }}>{revisoresCount} revisor(es)</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">SUPERVISORES ACTIVOS</span>
                            <strong className="report-meta-val" style={{ color: '#2563eb' }}>{supervisoresCount} supervisor(es)</strong>
                        </div>
                    </div>
                </Card>

                {/* Card principal con la tabla dinámica */}
                <Card className="report-card-section" style={{ padding: '24px' }}>
                    <div className="report-section-header" style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe'
                            }}>
                                <IconUsers size={20} />
                            </span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                    Directorio de colaboradores y perfiles
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                                    Gestiona credenciales, actualiza información de contacto o revoca accesos de manera segura.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Filtros y Búsqueda en Vivo */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '18px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 280px' }}>
                            <span style={{ color: '#64748b', fontSize: '14px' }}>🔍</span>
                            <input
                                type="text"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar por nombre, @usuario o correo..."
                                className="supervisor-input"
                                style={{ height: '36px', fontSize: '13px', margin: 0 }}
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                                >
                                    ✕ Limpiar
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginRight: '4px' }}>Filtrar rol:</span>
                            {(['todos', 'operario', 'revisor', 'supervisor'] as const).map((r) => {
                                const activo = filtroRol === r;
                                const count = r === 'todos'
                                    ? usuariosList.length
                                    : usuariosList.filter((u) => u.rol === r).length;
                                return (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setFiltroRol(r)}
                                        className={`supervisor-chip ${activo ? 'active' : ''}`}
                                        style={{ padding: '4px 10px', fontSize: '11.5px', margin: 0 }}
                                    >
                                        {r === 'todos' ? 'Todos' : r.charAt(0).toUpperCase() + r.slice(1)} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tabla Dinámica de Lectura */}
                    <div className="table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="report-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13.5px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '28%' }}>Colaborador / Usuario</th>
                                    <th style={{ width: '25%' }}>Correo electrónico</th>
                                    <th style={{ width: '15%' }}>Perfil / Rol</th>
                                    <th style={{ width: '14%' }}>Fecha de alta</th>
                                    <th style={{ width: '18%', textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '36px 16px' }}>
                                            <span style={{ color: '#64748b', fontSize: '13.5px' }}>Cargando usuarios desde Supabase / almacén local...</span>
                                        </td>
                                    </tr>
                                ) : usuariosFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px' }}>
                                            <p style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#0f172a' }}>
                                                No se encontraron colaboradores coincidentes.
                                            </p>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>
                                                Intenta con otro término de búsqueda o selecciona otro filtro de rol.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    usuariosFiltrados.map((u) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: u.rol === 'supervisor' ? '#2563eb' : u.rol === 'revisor' ? '#7c3aed' : '#0284c7',
                                                        color: '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '13px',
                                                        fontWeight: 700,
                                                        flexShrink: 0
                                                    }}>
                                                        {u.nombre.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <strong style={{ display: 'block', fontSize: '13.5px', color: '#0f172a' }}>
                                                            {u.nombre}
                                                        </strong>
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                                            @{u.username}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '13px', color: '#334155' }}>{u.email}</span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    background: u.rol === 'supervisor'
                                                        ? 'rgba(37, 99, 235, 0.1)'
                                                        : u.rol === 'revisor'
                                                            ? 'rgba(124, 58, 237, 0.1)'
                                                            : 'rgba(2, 132, 199, 0.1)',
                                                    color: u.rol === 'supervisor'
                                                        ? '#1d4ed8'
                                                        : u.rol === 'revisor'
                                                            ? '#6d28d9'
                                                            : '#0369a1',
                                                    border: `1px solid ${
                                                        u.rol === 'supervisor'
                                                            ? 'rgba(37, 99, 235, 0.25)'
                                                            : u.rol === 'revisor'
                                                                ? 'rgba(124, 58, 237, 0.25)'
                                                                : 'rgba(2, 132, 199, 0.25)'
                                                    }`
                                                }}>
                                                    <span style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: u.rol === 'supervisor' ? '#2563eb' : u.rol === 'revisor' ? '#7c3aed' : '#0284c7'
                                                    }} />
                                                    {u.rol === 'operario' ? 'Operario' : u.rol === 'revisor' ? 'Revisor' : 'Supervisor'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                                                    {formatearFecha(u.created_at)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirModalEditar(u)}
                                                        className="supervisor-header-btn"
                                                        style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', background: '#ffffff', color: '#334155' }}
                                                        title={`Editar datos de ${u.nombre}`}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirModalEliminar(u)}
                                                        className="supervisor-header-btn"
                                                        style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', color: '#dc2626', borderColor: '#fecaca', background: '#ffffff' }}
                                                        title={`Eliminar usuario ${u.nombre}`}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '14px 4px 0',
                        borderTop: '1px solid #f1f5f9',
                        marginTop: '12px',
                        fontSize: '12.5px',
                        color: '#64748b'
                    }}>
                        <span>Mostrando <strong>{usuariosFiltrados.length}</strong> de <strong>{usuariosList.length}</strong> colaboradores registrados</span>
                        <span>Directorio activo en EcoCleaner</span>
                    </div>
                </Card>
            </main>

            {/* ========================================================
                MODAL 1: REGISTRAR NUEVO USUARIO
                ======================================================== */}
            {modalCrearAbierto && (
                <div className="modal-overlay" onClick={() => setModalCrearAbierto(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <p className="section-kicker" style={{ margin: '0 0 2px' }}>Panel de Seguridad</p>
                                <h3>Registrar nuevo usuario</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                                    Ingresa los datos del colaborador y asigna sus credenciales de acceso.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setModalCrearAbierto(false)}
                                title="Cerrar ventana"
                            >
                                ✕
                            </button>
                        </div>

                        {mensajeCrear && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                marginBottom: '16px',
                                fontSize: '13px',
                                backgroundColor: mensajeCrear.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
                                color: mensajeCrear.tipo === 'ok' ? '#15803d' : '#b91c1c',
                                border: `1px solid ${mensajeCrear.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                            }}>
                                {mensajeCrear.texto}
                            </div>
                        )}

                        <form onSubmit={handleCrearUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <label className="supervisor-field-label">
                                Nombre completo *
                                <input
                                    required
                                    value={crearNombre}
                                    onChange={(e) => setCrearNombre(e.target.value)}
                                    placeholder="Ej. Carlos Mendoza"
                                    className="supervisor-input"
                                />
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <label className="supervisor-field-label">
                                    Nombre de usuario *
                                    <input
                                        required
                                        value={crearUsername}
                                        onChange={(e) => setCrearUsername(e.target.value)}
                                        placeholder="cmendoza"
                                        className="supervisor-input"
                                    />
                                </label>
                                <label className="supervisor-field-label">
                                    Contraseña *
                                    <input
                                        type="password"
                                        required
                                        value={crearPassword}
                                        onChange={(e) => setCrearPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="supervisor-input"
                                    />
                                </label>
                            </div>

                            <label className="supervisor-field-label">
                                Correo electrónico *
                                <input
                                    type="email"
                                    required
                                    value={crearEmail}
                                    onChange={(e) => setCrearEmail(e.target.value)}
                                    placeholder="cmendoza@ecocleaner.com"
                                    className="supervisor-input"
                                />
                            </label>

                            <div>
                                <label className="supervisor-field-label" style={{ marginBottom: '6px' }}>
                                    Asignar perfil / rol operativo *
                                </label>
                                <div className="role-selector-grid">
                                    <div
                                        className={`role-option-card ${crearRol === 'operario' ? 'selected' : ''}`}
                                        onClick={() => setCrearRol('operario')}
                                    >
                                        <span className="role-option-tag">OP</span>
                                        <span className="role-option-title">Operario</span>
                                        <span className="role-option-desc">Limpieza y recetas</span>
                                    </div>

                                    <div
                                        className={`role-option-card ${crearRol === 'revisor' ? 'selected' : ''}`}
                                        onClick={() => setCrearRol('revisor')}
                                    >
                                        <span className="role-option-tag">RV</span>
                                        <span className="role-option-title">Revisor</span>
                                        <span className="role-option-desc">Inspección y calidad</span>
                                    </div>

                                    <div
                                        className={`role-option-card ${crearRol === 'supervisor' ? 'selected' : ''}`}
                                        onClick={() => setCrearRol('supervisor')}
                                    >
                                        <span className="role-option-tag">SV</span>
                                        <span className="role-option-title">Supervisor</span>
                                        <span className="role-option-desc">Control y gestión</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                <button
                                    type="button"
                                    className="supervisor-header-btn"
                                    onClick={() => setModalCrearAbierto(false)}
                                    style={{ height: '36px', padding: '0 16px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoCrear}
                                    className="primary-button"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        height: '36px',
                                        padding: '0 18px',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: guardandoCrear ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <IconCheck size={16} />
                                    <span>{guardandoCrear ? 'Guardando...' : 'Crear usuario y perfil'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL 2: EDITAR INFORMACIÓN DE USUARIO
                ======================================================== */}
            {usuarioParaEditar && (
                <div className="modal-overlay" onClick={() => setUsuarioParaEditar(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <p className="section-kicker" style={{ margin: '0 0 2px' }}>Modificar perfil de usuario</p>
                                <h3>Editar usuario: {usuarioParaEditar.nombre}</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                                    Actualiza nombre, usuario, correo, contraseña o rol operativo.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setUsuarioParaEditar(null)}
                                title="Cerrar ventana"
                            >
                                ✕
                            </button>
                        </div>

                        {mensajeEditar && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                marginBottom: '16px',
                                fontSize: '13px',
                                backgroundColor: mensajeEditar.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
                                color: mensajeEditar.tipo === 'ok' ? '#15803d' : '#b91c1c',
                                border: `1px solid ${mensajeEditar.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                            }}>
                                {mensajeEditar.texto}
                            </div>
                        )}

                        <form onSubmit={handleActualizarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <label className="supervisor-field-label">
                                Nombre completo *
                                <input
                                    required
                                    value={editNombre}
                                    onChange={(e) => setEditNombre(e.target.value)}
                                    className="supervisor-input"
                                />
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <label className="supervisor-field-label">
                                    Nombre de usuario *
                                    <input
                                        required
                                        value={editUsername}
                                        onChange={(e) => setEditUsername(e.target.value)}
                                        className="supervisor-input"
                                    />
                                </label>
                                <label className="supervisor-field-label">
                                    Nueva contraseña
                                    <input
                                        type="password"
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        placeholder="(Dejar en blanco para conservar)"
                                        className="supervisor-input"
                                    />
                                </label>
                            </div>

                            <label className="supervisor-field-label">
                                Correo electrónico *
                                <input
                                    type="email"
                                    required
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="supervisor-input"
                                />
                            </label>

                            <div>
                                <label className="supervisor-field-label" style={{ marginBottom: '6px' }}>
                                    Perfil / Rol asignado *
                                </label>
                                <div className="role-selector-grid">
                                    <div
                                        className={`role-option-card ${editRol === 'operario' ? 'selected' : ''}`}
                                        onClick={() => setEditRol('operario')}
                                    >
                                        <span className="role-option-tag">OP</span>
                                        <span className="role-option-title">Operario</span>
                                        <span className="role-option-desc">Limpieza y recetas</span>
                                    </div>

                                    <div
                                        className={`role-option-card ${editRol === 'revisor' ? 'selected' : ''}`}
                                        onClick={() => setEditRol('revisor')}
                                    >
                                        <span className="role-option-tag">RV</span>
                                        <span className="role-option-title">Revisor</span>
                                        <span className="role-option-desc">Inspección y calidad</span>
                                    </div>

                                    <div
                                        className={`role-option-card ${editRol === 'supervisor' ? 'selected' : ''}`}
                                        onClick={() => setEditRol('supervisor')}
                                    >
                                        <span className="role-option-tag">SV</span>
                                        <span className="role-option-title">Supervisor</span>
                                        <span className="role-option-desc">Control y gestión</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                <button
                                    type="button"
                                    className="supervisor-header-btn"
                                    onClick={() => setUsuarioParaEditar(null)}
                                    style={{ height: '36px', padding: '0 16px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoEditar}
                                    className="primary-button"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        height: '36px',
                                        padding: '0 18px',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: guardandoEditar ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <IconCheck size={16} />
                                    <span>{guardandoEditar ? 'Guardando...' : 'Actualizar información'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL 3: CONFIRMAR ELIMINACIÓN DE USUARIO
                ======================================================== */}
            {usuarioParaEliminar && (
                <div className="modal-overlay" onClick={() => setUsuarioParaEliminar(null)}>
                    <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: '#fee2e2',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                flexShrink: 0
                            }}>
                                <IconAlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 700 }}>
                                    ¿Eliminar colaborador?
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                                    Confirmación de revocación de cuenta
                                </p>
                            </div>
                        </div>

                        {mensajeEliminar && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                marginBottom: '14px',
                                fontSize: '13px',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca'
                            }}>
                                {mensajeEliminar}
                            </div>
                        )}

                        <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                            Estás a punto de eliminar a <strong>{usuarioParaEliminar.nombre}</strong> (@{usuarioParaEliminar.username}) con perfil de <strong>{usuarioParaEliminar.rol.toUpperCase()}</strong>. Esta acción revocará sus credenciales de acceso a EcoCleaner de manera permanente.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                className="supervisor-header-btn"
                                onClick={() => setUsuarioParaEliminar(null)}
                                style={{ height: '36px', padding: '0 16px' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={eliminandoUsuario}
                                onClick={handleConfirmarEliminar}
                                style={{
                                    height: '36px',
                                    padding: '0 18px',
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: eliminandoUsuario ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {eliminandoUsuario ? 'Eliminando...' : 'Sí, eliminar usuario'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast flotante */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 10000,
                    background: toast.tipo === 'ok' ? '#0f172a' : '#991b1b',
                    color: '#ffffff',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span>{toast.tipo === 'ok' ? 'Listo' : 'Aviso'}</span>
                    <span>{toast.texto}</span>
                </div>
            )}
        </div>
    );
}
