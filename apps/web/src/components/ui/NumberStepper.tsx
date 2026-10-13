import { useEffect, useState, type InputHTMLAttributes } from 'react'

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
 * Control numérico editable: permite digitar directamente con el teclado
 * o ajustar el valor mediante botones de incremento y decremento (+ / −).
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
  const [textValue, setTextValue] = useState<string>(
    value !== undefined && value !== null ? String(value) : '',
  )

  useEffect(() => {
    setTextValue(value !== undefined && value !== null ? String(value) : '')
  }, [value])

  const clamp = (next: number) => {
    let bounded = next
    if (min !== undefined) bounded = Math.max(min, bounded)
    if (max !== undefined) bounded = Math.min(max, bounded)
    return Number(bounded.toFixed(3))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setTextValue(raw)

    if (raw.trim() === '' || raw === '-' || raw.endsWith('.')) {
      return
    }

    const parsed = Number(raw)
    if (!isNaN(parsed)) {
      onChange(parsed)
    }
  }

  const handleBlur = () => {
    if (textValue.trim() === '' || isNaN(Number(textValue))) {
      const fallback = min !== undefined ? min : 0
      setTextValue(String(fallback))
      onChange(fallback)
    } else {
      const parsed = Number(textValue)
      const bounded = clamp(parsed)
      setTextValue(String(bounded))
      onChange(bounded)
    }
  }

  const handleStep = (delta: number) => {
    const current =
      typeof value === 'number' && !isNaN(value) ? value : (min ?? 0)
    const next = clamp(current + delta)
    setTextValue(String(next))
    onChange(next)
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
          onClick={() => handleStep(-step)}
          disabled={min !== undefined && value <= min}
        >
          −
        </button>
        <div className="ui-stepper-input-wrapper">
          <input
            id={id}
            type="number"
            step="any"
            min={min}
            max={max}
            value={textValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="ui-stepper-input"
            aria-label={label}
            {...props}
          />
          {unit && <span className="ui-stepper-unit">{unit}</span>}
        </div>
        <button
          type="button"
          className="ui-stepper-button"
          aria-label={`Aumentar ${label}`}
          onClick={() => handleStep(step)}
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
    </div>
  )
}
