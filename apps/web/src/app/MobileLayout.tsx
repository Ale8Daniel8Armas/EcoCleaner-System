import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { obtenerUsuarioActual, cerrarSesion } from '../services/usuarios'
import { SupervisorSidebar } from '../features/supervisor/components/SupervisorSidebar'
import { OperarioSidebar } from '../features/operario/components/OperarioSidebar'
import { RevisorSidebar } from '../features/revisor/components/RevisorSidebar'
import { canShowDemo } from '../features/supervisor/explainer/config'
import { IconBell, IconLogout, IconPanel, IconLayers, IconChartBar, IconDroplet, IconFlask, IconClipboardCheck, IconHome, IconQr, IconBuilding } from '../components/ui/Icons'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  activo?: boolean
}

const supervisorNav: NavItem[] = [
  { to: '/supervisor/panel', label: 'Panel', icon: <IconPanel size={18} /> },
  { to: '/supervisor/comparacion', label: 'Comparar', icon: <IconLayers size={18} /> },
  { to: '/supervisor/reporte', label: 'Reporte', icon: <IconChartBar size={18} /> },
  { to: '/supervisor/efluente', label: 'Efluente', icon: <IconDroplet size={18} /> },
]

const revisorNav: NavItem[] = [
  { to: '/revisor', label: 'Bandeja', icon: <IconClipboardCheck size={18} />, end: true },
]

export default function MobileLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const usuario = obtenerUsuarioActual()

  const enFlujoOperario = /^\/operario\/(receta)/.test(pathname)
  const operarioNav: NavItem[] = [
    { to: '/operario', label: 'Inicio', icon: <IconHome size={18} />, end: true },
    {
      to: '/operario/receta',
      label: 'Receta',
      icon: <IconFlask size={18} />,
      activo: enFlujoOperario,
    },
    { to: '/operario/sitios', label: 'Sitios', icon: <IconBuilding size={18} /> },
    { to: '/escanear', label: 'Escanear', icon: <IconQr size={18} /> },
  ]

  let items = operarioNav
  let roleLabel = 'Usuario'
  let roleInitials = 'US'

  if (pathname.startsWith('/supervisor') || usuario?.rol === 'supervisor') {
    items = canShowDemo(usuario?.rol, import.meta.env.VITE_LLM_MODE)
      ? [...supervisorNav, { to: '/supervisor/asistente', label: 'LLM demo', icon: <IconClipboardCheck size={18} /> }]
      : supervisorNav
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
  const isOperarioRoute = pathname.startsWith('/operario') || pathname.startsWith('/escanear')
  const isRevisorRoute = pathname.startsWith('/revisor')
  const hasDesktopSidebar = isSupervisorRoute || isOperarioRoute || isRevisorRoute
  const showNav = pathname !== '/' && !pathname.startsWith('/areas')

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
