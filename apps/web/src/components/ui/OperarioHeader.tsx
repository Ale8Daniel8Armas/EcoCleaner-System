import { Link } from 'react-router-dom'
import { RouteBreadcrumb, type Crumb } from './RouteBreadcrumb'
import { StepIndicator, type Step } from './StepIndicator'
import logo from '../../assets/ecoapp_logo.svg'

interface OperarioHeaderProps {
  title: string
  eyebrow?: string
  backTo?: string
  breadcrumb?: Crumb[]
  steps?: Step[]
  currentStep?: number
  actions?: React.ReactNode
}

export function OperarioHeader({
  title,
  eyebrow = 'EcoCleaner / Operario',
  backTo,
  breadcrumb,
  steps,
  currentStep = 0,
  actions,
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
            <img className="brand-logo" src={logo} alt="EcoCleaner App" />
          )}
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
        </div>
        {actions && <div className="operario-header-actions">{actions}</div>}
      </div>
      {breadcrumb && <RouteBreadcrumb items={breadcrumb} />}
      {steps && <StepIndicator steps={steps} current={currentStep} />}
    </header>
  )
}
