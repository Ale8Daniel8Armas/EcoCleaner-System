import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { obtenerUsuarioActual, cerrarSesion } from '../services/usuarios'
import { SupervisorSidebar } from '../features/supervisor/components/SupervisorSidebar'
import { OperarioSidebar } from '../features/operario/components/OperarioSidebar'
import { RevisorSidebar } from '../features/revisor/components/RevisorSidebar'
import { IconBell, IconLogout } from '../components/ui/Icons'

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
  const navigate = useNavigate()
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
  let roleLabel = 'Usuario'
  let roleInitials = 'US'

  if (pathname.startsWith('/supervisor') || usuario?.rol === 'supervisor') {
    items = supervisorNav
    roleLabel = 'Supervisor'
    roleInitials = 'SV'
  } else if (pathname.startsWith('/revisor') || usuario?.rol === 'revisor') {
    items = revisorNav
    roleLabel = 'Revisor'
    roleInitials = 'RV'
  } else if (pathname.startsWith('/operario') || usuario?.rol === 'operario') {
    items = operarioNav
    roleLabel = 'Operario'
    roleInitials = 'OP'
  }

  const isSupervisorRoute = pathname.startsWith('/supervisor')
  const isOperarioRoute = pathname.startsWith('/operario')
  const isRevisorRoute = pathname.startsWith('/revisor')
  const hasDesktopSidebar = isSupervisorRoute || isOperarioRoute || isRevisorRoute
  const showNav = pathname !== '/'

  const handleCerrarSesion = () => {
    cerrarSesion()
    navigate('/')
  }

  return (
    <div className={`app-layout${isSupervisorRoute ? ' app-layout--supervisor' : ''}${isOperarioRoute ? ' app-layout--operario' : ''}${isRevisorRoute ? ' app-layout--revisor' : ''}`}>
      {isSupervisorRoute && <SupervisorSidebar />}
      {isOperarioRoute && <OperarioSidebar />}
      {isRevisorRoute && <RevisorSidebar />}
      <div className={`app-content-column${hasDesktopSidebar ? ' app-content-column--with-sidebar' : ''}`}>
        {showNav && (
          <header className="layout-topbar">
            <div className="layout-topbar-left" />
            <div className="layout-topbar-right">
              <button
                type="button"
                className="layout-topbar-bell"
                title="Notificaciones"
                aria-label="Notificaciones"
              >
                <IconBell size={18} />
              </button>
              <span className="layout-topbar-role">{roleLabel}</span>
              <div className="layout-topbar-avatar" aria-label={`Perfil ${roleLabel}`}>
                {roleInitials}
              </div>
              <button
                type="button"
                className="layout-topbar-logout"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={handleCerrarSesion}
              >
                <IconLogout size={18} />
              </button>
            </div>
          </header>
        )}
        <main className={`app-main${!showNav ? ' app-main--no-nav' : ''}${hasDesktopSidebar ? ' app-main--with-sidebar' : ''}`}>
          <Outlet />
        </main>
      </div>

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
