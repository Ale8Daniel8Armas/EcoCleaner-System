import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconClipboardCheck,
  IconLogout,
} from '../../../components/ui';
import { cerrarSesion, obtenerUsuarioActual } from '../../../services/usuarios';

export function RevisorSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const usuario = obtenerUsuarioActual();

  const isBandejaActive = currentPath === '/revisor' || currentPath.startsWith('/revisor/validar') || currentPath.startsWith('/revisor/uso');

  const scrollToTop = () => {
    if (currentPath === '/revisor') {
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
    <aside className="revisor-desktop-sidebar supervisor-desktop-sidebar" aria-label="Navegación del revisor">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" style={{ background: '#059669' }}>EC</span>
        <div>
          <span className="sidebar-brand-title">EcoCleaner</span>
          <span style={{ display: 'block', fontSize: '11px', color: '#34d399', fontWeight: 600, letterSpacing: '0.04em' }}>
            AUDITORÍA Y REVISIÓN
          </span>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        <Link
          to="/revisor"
          onClick={scrollToTop}
          className={`sidebar-nav-item ${isBandejaActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconClipboardCheck size={18} />
          </span>
          <span className="sidebar-nav-label">Bandeja de validación</span>
        </Link>
      </nav>

      {/* Tarjeta de estado del revisor en el pie del sidebar */}
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
            background: 'rgba(5, 150, 105, 0.25)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: '#34d399',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: '12px'
          }}>
            {usuario?.nombre ? usuario.nombre.slice(0, 2).toUpperCase() : 'RV'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {usuario?.nombre || 'Revisor Técnico'}
            </p>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Auditoría y certificación
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
          <span>Bandeja conectada</span>
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
