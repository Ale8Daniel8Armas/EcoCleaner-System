import { Link, useLocation } from 'react-router-dom';
import {
  IconPanel,
  IconUsers,
  IconFlask,
  IconBuilding,
  IconChartBar,
  IconLayers,
  IconDroplet,
  IconClipboardCheck,
} from '../../../components/ui';
import logo from '../../../assets/ecoapp_logo.svg';
import { obtenerUsuarioActual } from '../../../services/usuarios';
import { canShowDemo } from '../explainer/config';

export function SupervisorSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isPanelActive =
    currentPath === '/supervisor' || currentPath === '/supervisor/panel';

  const isUsuariosActive = currentPath.startsWith('/supervisor/usuarios');
  const isCatalogoActive = currentPath.startsWith('/supervisor/productos');
  const isSitiosActive = currentPath.startsWith('/supervisor/sitios');
  const isComparacionActive = currentPath.startsWith('/supervisor/comparacion');
  const isEfluenteActive = currentPath.startsWith('/supervisor/efluente');
  const isReportesActive = currentPath.startsWith('/supervisor/reporte');
  const isAssistantActive = currentPath.startsWith('/supervisor/asistente');
  const showDemo = canShowDemo(obtenerUsuarioActual()?.rol, import.meta.env.VITE_LLM_MODE);

  const scrollToTop = () => {
    if (currentPath === '/supervisor' || currentPath === '/supervisor/panel') {
      const mainEl = document.querySelector('.app-main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <aside className="supervisor-desktop-sidebar" aria-label="Navegación del supervisor">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark"><img src={logo} alt="" /></span>
        <span className="sidebar-brand-title">EcoCleaner</span>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/supervisor"
          onClick={scrollToTop}
          className={`sidebar-nav-item ${isPanelActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconPanel size={18} />
          </span>
          <span className="sidebar-nav-label">Panel</span>
        </Link>

        {showDemo && (
          <Link
            to="/supervisor/asistente"
            className={`sidebar-nav-item ${isAssistantActive ? 'is-active' : ''}`}
            aria-current={isAssistantActive ? 'page' : undefined}
          >
            <span className="sidebar-nav-icon">
              <IconClipboardCheck size={18} />
            </span>
            <span className="sidebar-nav-label">Asistente LLM (demo)</span>
          </Link>
        )}

        <Link
          to="/supervisor/usuarios"
          className={`sidebar-nav-item ${isUsuariosActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconUsers size={18} />
          </span>
          <span className="sidebar-nav-label">Gestión de usuarios</span>
        </Link>

        <Link
          to="/supervisor/productos/nuevo"
          className={`sidebar-nav-item ${isCatalogoActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconFlask size={18} />
          </span>
          <span className="sidebar-nav-label">Catálogo técnico</span>
        </Link>

        <Link
          to="/supervisor/sitios"
          className={`sidebar-nav-item ${isSitiosActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconBuilding size={18} />
          </span>
          <span className="sidebar-nav-label">Sitios</span>
        </Link>

        <Link
          to="/supervisor/comparacion"
          className={`sidebar-nav-item ${isComparacionActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconLayers size={18} />
          </span>
          <span className="sidebar-nav-label">Comparación</span>
        </Link>

        <Link
          to="/supervisor/efluente"
          className={`sidebar-nav-item ${isEfluenteActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconDroplet size={18} />
          </span>
          <span className="sidebar-nav-label">Efluentes</span>
        </Link>

        <Link
          to="/supervisor/reporte"
          className={`sidebar-nav-item ${isReportesActive ? 'is-active' : ''}`}
        >
          <span className="sidebar-nav-icon">
            <IconChartBar size={18} />
          </span>
          <span className="sidebar-nav-label">Reportes</span>
        </Link>
      </nav>
    </aside>
  );
}
