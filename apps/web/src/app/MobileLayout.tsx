import { NavLink, Outlet, useLocation } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

const operarioNav: NavItem[] = [
  { to: '/operario', label: 'Inicio', icon: '🏠', end: true },
  { to: '/operario/receta', label: 'Receta', icon: '🧪' },
]

const supervisorNav: NavItem[] = [
  { to: '/supervisor', label: 'Inicio', icon: '🏠', end: true },
  { to: '/supervisor/panel', label: 'Panel', icon: '📊' },
  { to: '/supervisor/comparacion', label: 'Comparar', icon: '📈' },
  { to: '/supervisor/reporte', label: 'Reporte', icon: '🖨️' },
  { to: '/supervisor/efluente', label: 'Efluente', icon: '💧' },
]

export default function MobileLayout() {
  const { pathname } = useLocation()
  const items = pathname.startsWith('/supervisor') ? supervisorNav : operarioNav

  return (
    <div className="app-layout">
      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav" aria-label="Navegación principal">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `nav-item${isActive ? ' is-active' : ''}`
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
