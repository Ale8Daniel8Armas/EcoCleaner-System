import { Link, Navigate } from 'react-router-dom'
import { IconArrowLeft } from '../../../components/ui'
import { obtenerUsuarioActual } from '../../../services/usuarios'
import { canShowDemo, isLocalLLMEnabled } from '../explainer/config'
import { DemoErrorBoundary, DemoExplainer } from '../explainer/DemoExplainer'
import { LiveAssistant } from '../explainer/LiveAssistant'
import { useState } from 'react'

export default function LlmAssistant() {
  const [showDemo, setShowDemo] = useState(false)
  const live = isLocalLLMEnabled()
  const role = obtenerUsuarioActual()?.rol
  if (!canShowDemo(role, import.meta.env.VITE_LLM_MODE))
    return <Navigate to="/supervisor" replace />

  return (
    <div className="supervisor-shell">
      <header className="supervisor-header">
        <div>
          <p className="eyebrow">EcoCleaner / Supervisor</p>
          <h1>
            {live ? 'Asistente LLM · Groq local' : 'Asistente LLM (demo)'}
          </h1>
        </div>
        <Link className="supervisor-header-btn" to="/supervisor">
          <IconArrowLeft size={16} /> Volver al panel
        </Link>
      </header>
      <DemoErrorBoundary>
        {live && (
          <button
            className="supervisor-header-btn"
            type="button"
            onClick={() => setShowDemo(!showDemo)}
          >
            {showDemo ? 'Volver a Groq local' : 'Ver modo demo sin IA'}
          </button>
        )}
        {live && !showDemo ? (
          <LiveAssistant />
        ) : (
          <DemoExplainer role={role} initialPanel="explanation" />
        )}
      </DemoErrorBoundary>
    </div>
  )
}
