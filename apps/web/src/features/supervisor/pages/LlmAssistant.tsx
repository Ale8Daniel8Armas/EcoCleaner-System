import { Link, Navigate } from 'react-router-dom'
import { IconArrowLeft } from '../../../components/ui'
import { obtenerUsuarioActual } from '../../../services/usuarios'
import { canShowDemo } from '../explainer/config'
import { DemoErrorBoundary, DemoExplainer } from '../explainer/DemoExplainer'

export default function LlmAssistant() {
  const role = obtenerUsuarioActual()?.rol
  if (!canShowDemo(role, import.meta.env.VITE_LLM_MODE))
    return <Navigate to="/supervisor" replace />

  return (
    <div className="supervisor-shell">
      <header className="supervisor-header">
        <div>
          <p className="eyebrow">EcoCleaner / Supervisor</p>
          <h1>Asistente LLM (demo)</h1>
        </div>
        <Link className="supervisor-header-btn" to="/supervisor">
          <IconArrowLeft size={16} /> Volver al panel
        </Link>
      </header>
      <DemoErrorBoundary>
        <DemoExplainer role={role} initialPanel="explanation" />
      </DemoErrorBoundary>
    </div>
  )
}
