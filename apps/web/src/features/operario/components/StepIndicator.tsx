import { Link } from 'react-router-dom'

export interface Step {
  label: string
  to?: string
}

interface StepIndicatorProps {
  steps: Step[]
  /** Índice 0-based del paso actual. */
  current: number
}

/** Progreso del flujo del operario (Paso X de N). Local al operario. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Progreso de la tarea">
      <span className="step-counter">
        Paso {current + 1} de {steps.length}
      </span>
      <ol className="step-list">
        {steps.map((step, index) => {
          const state =
            index < current ? 'done' : index === current ? 'current' : 'todo'
          const body = (
            <>
              <span className="step-dot" aria-hidden="true">
                {index < current ? '✓' : index + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </>
          )
          return (
            <li className={`step-item is-${state}`} key={step.label}>
              {step.to && index < current ? (
                <Link className="step-link" to={step.to}>
                  {body}
                </Link>
              ) : (
                <span
                  className="step-link"
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  {body}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
