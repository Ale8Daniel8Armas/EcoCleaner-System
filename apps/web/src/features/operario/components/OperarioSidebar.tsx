import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconPanel,
  IconFlask,
  IconQr,
  IconBuilding,
  IconLogout,
} from '../../../components/ui';
import logo from '../../../assets/ecoapp_logo.svg';
import { cerrarSesion, obtenerUsuarioActual } from '../../../services/usuarios';

export function OperarioSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const usuario = obtenerUsuarioActual();

  const isInicioActive = currentPath === '/operario' || currentPath === '/operario/';
  const isRecetaActive = currentPath.startsWith('/operario/receta');
  const isSitiosActive = currentPath.startsWith('/operario/sitios');
  const isEscanearActive = currentPath.startsWith('/escanear');

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
        <span className="sidebar-brand-mark" style={{ background: '#2563eb' }}><img src={logo} alt="" /></span>
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

        <Link
          to="/operario/sitios"
          className={`sidebar-nav-item ${isSitiosActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconBuilding size={18} />
          </span>
          <span className="sidebar-nav-label">Sitios y áreas</span>
        </Link>

        <Link
          to="/escanear"
          className={`sidebar-nav-item ${isEscanearActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconQr size={18} />
          </span>
          <span className="sidebar-nav-label">Escanear QR</span>
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
