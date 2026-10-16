import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconClipboardCheck,
  IconLogout,
} from '../../../components/ui';
import { cerrarSesion } from '../../../services/usuarios';
import logo from '../../../assets/ecoapp_logo.svg';

export function RevisorSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

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
        <span className="sidebar-brand-mark" style={{ background: '#059669' }}><img src={logo} alt="" /></span>
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
