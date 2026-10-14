import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { obtenerUsuarioActual } from '../services/usuarios'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  activo?: boolean
}

const supervisorNav: NavItem[] = [
  { to: '/supervisor/panel', label: 'Panel', icon: '📊' },
  { to: '/supervisor/comparacion', label: 'Comparar', icon: '📈' },
  { to: '/supervisor/reporte', label: 'Reporte', icon: '🖨️' },
  { to: '/supervisor/efluente', label: 'Efluente', icon: '💧' },
]

const revisorNav: NavItem[] = [
  { to: '/revisor', label: 'Bandeja', icon: '📥', end: true },
]

export default function MobileLayout() {
  const { pathname } = useLocation()
  const usuario = obtenerUsuarioActual()

  const enFlujoOperario = /^\/operario\/(receta)/.test(pathname)
  const operarioNav: NavItem[] = [
    { to: '/operario', label: 'Inicio', icon: '🏠', end: true },
    {
      to: '/operario/receta',
      label: 'Receta',
      icon: '🧪',
      activo: enFlujoOperario,
    },
  ]

  let items = operarioNav
  if (pathname.startsWith('/supervisor') || usuario?.rol === 'supervisor') {
    items = supervisorNav
  } else if (pathname.startsWith('/revisor') || usuario?.rol === 'revisor') {
    items = revisorNav
  } else {
    items = operarioNav
  }

  const showNav = pathname !== '/'

  return (
    <div className="app-layout">
      <main className={`app-main${!showNav ? ' app-main--no-nav' : ''}`}>
        <Outlet />
      </main>

      {showNav && (
        <nav className="app-nav" aria-label="Navegación principal">
          {items.map((item) => {
            const to = item.activo ? pathname : item.to
            return (
              <NavLink
                key={item.label}
                to={to}
                end={item.end}
                className={({ isActive }) =>
                  `nav-item${(item.activo ?? isActive) ? ' is-active' : ''}`
                }
                aria-current={item.activo ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
