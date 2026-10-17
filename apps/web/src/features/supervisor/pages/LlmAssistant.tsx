import { Link, Navigate } from 'react-router-dom'
import { IconArrowLeft } from '../../../components/ui'
import { obtenerUsuarioActual } from '../../../services/usuarios'
import { canShowDemo, isLocalLLMEnabled } from '../explainer/config'
import { DemoErrorBoundary, DemoExplainer } from '../explainer/DemoExplainer'
import { LiveAssistant } from '../explainer/LiveAssistant'
import { useState } from 'react'
import '../explainer/live-assistant.css'

export default function LlmAssistant() {
  const [showDemo, setShowDemo] = useState(false)
  const live = isLocalLLMEnabled()
  const role = obtenerUsuarioActual()?.rol
  if (!canShowDemo(role, import.meta.env.VITE_LLM_MODE))
    return <Navigate to="/supervisor" replace />

  return (
    <div className={`supervisor-shell${live ? ' llm-assistant-page' : ''}`}>
      <header className="supervisor-header">
        <div>
          <p className="eyebrow">EcoCleaner / Supervisor</p>
          <div className="llm-title-row">
            <h1>{live ? 'Asistente EcoCleaner' : 'Asistente LLM (demo)'}</h1>
            {live && <span className="llm-local-badge">Evaluación local</span>}
          </div>
        </div>
        <div className="header-actions llm-header-actions">
          {live && (
            <button
              className="supervisor-header-btn"
              type="button"
              onClick={() => setShowDemo(!showDemo)}
            >
              {showDemo ? 'Volver al asistente' : 'Ver modo demo sin IA'}
            </button>
          )}
          <Link className="supervisor-header-btn" to="/supervisor">
            <IconArrowLeft size={16} /> Volver al panel
          </Link>
        </div>
      </header>
      <DemoErrorBoundary>
        {live && !showDemo ? (
          <LiveAssistant />
        ) : (
          <DemoExplainer role={role} initialPanel="explanation" />
        )}
      </DemoErrorBoundary>
    </div>
  )
}
