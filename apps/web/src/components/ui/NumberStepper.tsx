import type { InputHTMLAttributes } from 'react'

type NumberStepperProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'id'
> & {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  hint?: string
  error?: string
}

/**
 * Selector numérico sin texto libre (RF-04, RNF-01): el valor se ajusta con
 * botones de incremento y decremento; el campo solo muestra el resultado.
 */
export function NumberStepper({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
  hint,
  error,
  ...props
}: NumberStepperProps) {
  const clamp = (next: number) => {
    let bounded = next
    if (min !== undefined) bounded = Math.max(min, bounded)
    if (max !== undefined) bounded = Math.min(max, bounded)
    return Number(bounded.toFixed(3))
  }
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="ui-stepper">
      <label className="ui-stepper-label" htmlFor={id}>
        {label}
      </label>
      <div
        className="ui-stepper-controls"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        <button
          type="button"
          className="ui-stepper-button"
          aria-label={`Disminuir ${label}`}
          onClick={() => onChange(clamp(value - step))}
          disabled={min !== undefined && value <= min}
        >
          −
        </button>
        <output id={id} className="ui-stepper-value">
          {value}
          {unit && <span className="ui-stepper-unit">{unit}</span>}
        </output>
        <button
          type="button"
          className="ui-stepper-button"
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(clamp(value + step))}
          disabled={max !== undefined && value >= max}
        >
          +
        </button>
      </div>
      {hint && !error && (
        <span id={`${id}-hint`} className="ui-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="ui-field-error" role="alert">
          {error}
        </span>
      )}
      <input type="hidden" readOnly value={value} {...props} />
    </div>
  )
}
