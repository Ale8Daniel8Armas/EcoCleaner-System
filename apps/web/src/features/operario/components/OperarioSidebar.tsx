import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconPanel,
  IconFlask,
  IconLogout,
} from '../../../components/ui';
import { cerrarSesion, obtenerUsuarioActual } from '../../../services/usuarios';

export function OperarioSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const usuario = obtenerUsuarioActual();

  const isInicioActive = currentPath === '/operario' || currentPath === '/operario/';
  const isRecetaActive = currentPath.startsWith('/operario/receta');

  const scrollToTop = () => {
    if (isInicioActive) {
      const mainEl = document.querySelector('.app-main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCerrarSesion = () => {
    cerrarSesion();
    navigate('/');
  };

  return (
    <aside className="operario-desktop-sidebar supervisor-desktop-sidebar" aria-label="Navegación del operario">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" style={{ background: '#2563eb' }}>EC</span>
        <div>
          <span className="sidebar-brand-title">EcoCleaner</span>
          <span style={{ display: 'block', fontSize: '11px', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.04em' }}>
            ESTACIÓN OPERARIO
          </span>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        <Link
          to="/operario"
          onClick={scrollToTop}
          className={`sidebar-nav-item ${isInicioActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconPanel size={18} />
          </span>
          <span className="sidebar-nav-label">Panel y tareas</span>
        </Link>

        <Link
          to="/operario/receta"
          className={`sidebar-nav-item ${isRecetaActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconFlask size={18} />
          </span>
          <span className="sidebar-nav-label">Preparar receta</span>
        </Link>
      </nav>

      {/* Tarjeta de estado de turno y operario en el pie del sidebar */}
      <div style={{
        marginTop: 'auto',
        padding: '14px',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(37, 99, 235, 0.25)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            color: '#60a5fa',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: '12px'
          }}>
            {usuario?.nombre ? usuario.nombre.slice(0, 2).toUpperCase() : 'OP'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {usuario?.nombre || 'Operario Activo'}
            </p>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Turno operativo
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '4px 8px',
          borderRadius: '6px',
          fontWeight: 500
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          <span>Estación conectada</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCerrarSesion}
        className="sidebar-nav-item"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          color: '#94a3b8'
        }}
      >
        <span className="sidebar-nav-icon">
          <IconLogout size={18} />
        </span>
        <span className="sidebar-nav-label">Cerrar sesión</span>
      </button>
    </aside>
  );
}
