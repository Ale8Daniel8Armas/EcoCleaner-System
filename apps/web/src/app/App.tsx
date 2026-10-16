import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import MobileLayout from './MobileLayout'
import Home from './Home'
import OperarioHome from '../features/operario/pages/OperarioHome'
import Recipe from '../features/operario/pages/Recipe'
import Sites from '../features/operario/pages/Sites'
import RevisorHome from '../features/revisor/pages/RevisorHome'
import ValidationWizard from '../features/revisor/pages/ValidationWizard'
import UsageLog from '../features/revisor/pages/UsageLog'
import Criteria from '../features/revisor/pages/Criteria'
import RevisorEffluent from '../features/revisor/pages/Effluent'
import { OperarioFlowProvider } from '../context/OperarioFlowContext'
import SupervisorHome from '../features/supervisor/pages/SupervisorHome'
import NewSite from '../features/supervisor/pages/NewSite'
import SitesList from '../features/supervisor/pages/SitesList'
import NewProduct from '../features/supervisor/pages/NewProduct'
import Comparison from '../features/supervisor/pages/Comparison'
import Report from '../features/supervisor/pages/Report'
import SupervisorEffluent from '../features/supervisor/pages/Effluent'
import UsersManagement from '../features/supervisor/pages/UsersManagement'
import AreaInfo from '../features/areas/pages/AreaInfo'
import ScanArea from '../features/areas/pages/ScanArea'
import { obtenerRolActual, type RolUsuario } from '../services/usuarios'
import { lazy, Suspense } from 'react'

const demoToolsEnabled = import.meta.env.VITE_DEMO_TOOLS === 'true'
const Simulator = demoToolsEnabled
  ? lazy(() => import('../features/operario/pages/Simulator'))
  : null

interface RoleRouteGuardProps {
  rolRequerido: RolUsuario
}

function RoleRouteGuard({ rolRequerido }: RoleRouteGuardProps) {
  const [rolActual, setRolActual] = useState<RolUsuario | null | 'cargando'>('cargando')
  const location = useLocation()

  useEffect(() => {
    let activo = true
    obtenerRolActual().then((rol) => {
      if (!activo) return
      setRolActual(rol)
    })
    return () => {
      activo = false
    }
  }, [location.pathname])

  if (rolActual === 'cargando') {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        Verificando perfil y credenciales de acceso…
      </div>
    )
  }

  // Si no hay usuario activo, redirigir a Login /
  if (!rolActual) {
    return <Navigate to="/" replace />
  }

  // Si el usuario entra por URL a otra ruta que no corresponde a su rol, redirigir a su inicio
  if (rolActual !== rolRequerido) {
    if (rolActual === 'supervisor') return <Navigate to="/supervisor" replace />
    if (rolActual === 'revisor') return <Navigate to="/revisor" replace />
    return <Navigate to="/operario" replace />
  }

  return <Outlet />
}

export function App() {
  return (
    <BrowserRouter>
      <OperarioFlowProvider>
        <Routes>
          <Route element={<MobileLayout />}>
            {/* Página pública del área (acceso por QR) y escáner del operario */}
            <Route path="/areas/:areaId" element={<AreaInfo />} />
            <Route path="/escanear" element={<ScanArea />} />

            {/* Página de inicio / Login */}
            <Route path="/" element={<Home />} />

            {/* Rutas exclusivas del rol OPERARIO */}
            <Route element={<RoleRouteGuard rolRequerido="operario" />}>
              <Route path="/operario" element={<OperarioHome />} />
              <Route path="/operario/receta" element={<Recipe />} />
              <Route path="/operario/sitios" element={<Sites />} />
              {Simulator && (
                <Route path="/operario/simulador" element={<Suspense fallback={<div className="ui-loading">Cargando demostración…</div>}><Simulator /></Suspense>} />
              )}
            </Route>

            {/* Rutas exclusivas del rol REVISOR */}
            <Route element={<RoleRouteGuard rolRequerido="revisor" />}>
              <Route path="/revisor" element={<RevisorHome />} />
              <Route path="/revisor/validar/:tareaId" element={<ValidationWizard />} />
              <Route path="/revisor/uso/:tareaId" element={<UsageLog />} />
              <Route path="/revisor/criterio/:registroId" element={<Criteria />} />
              <Route path="/revisor/efluente/:registroId" element={<RevisorEffluent />} />
            </Route>

            {/* Rutas exclusivas del rol SUPERVISOR */}
            <Route element={<RoleRouteGuard rolRequerido="supervisor" />}>
              <Route path="/supervisor" element={<SupervisorHome />} />
              <Route path="/supervisor/panel" element={<SupervisorHome />} />
              <Route path="/supervisor/sitios" element={<SitesList />} />
              <Route path="/supervisor/sitios/nuevo" element={<NewSite />} />
              <Route path="/supervisor/productos/nuevo" element={<NewProduct />} />
              <Route path="/supervisor/comparacion" element={<Comparison />} />
              <Route path="/supervisor/reporte" element={<Report />} />
              <Route path="/supervisor/efluente" element={<SupervisorEffluent />} />
              <Route path="/supervisor/usuarios" element={<UsersManagement />} />
            </Route>

            {/* Ruta catch-all para redirigir a inicio */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </OperarioFlowProvider>
    </BrowserRouter>
  )
}