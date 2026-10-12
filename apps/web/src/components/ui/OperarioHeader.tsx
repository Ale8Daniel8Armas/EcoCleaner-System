import { Link } from 'react-router-dom'
import { RouteBreadcrumb, type Crumb } from './RouteBreadcrumb'
import { StepIndicator, type Step } from './StepIndicator'

interface OperarioHeaderProps {
  title: string
  backTo?: string
  breadcrumb: Crumb[]
  steps?: Step[]
  currentStep?: number
}

/** Encabezado consistente de las pantallas del operario. Local al operario. */
export function OperarioHeader({
  title,
  backTo,
  breadcrumb,
  steps,
  currentStep = 0,
}: OperarioHeaderProps) {
  return (
    <header className="operario-header">
      <div className="operario-header-top">
        <div className="brand-lockup">
          {backTo ? (
            <Link className="back-link" to={backTo} aria-label="Volver">
              ←
            </Link>
          ) : (
            <span className="brand-mark">EC</span>
          )}
          <div>
            <p className="eyebrow">EcoCleaner / Operario</p>
            <h1>{title}</h1>
          </div>
        </div>
        <span className="simulated-badge">
          <span className="status-dot" /> Datos simulados
        </span>
      </div>
      <RouteBreadcrumb items={breadcrumb} />
      {steps && <StepIndicator steps={steps} current={currentStep} />}
    </header>
  )
}
