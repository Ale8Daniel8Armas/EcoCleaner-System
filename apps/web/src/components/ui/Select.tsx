import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  /** `inline` conserva el filtro en fila del panel; por defecto es vertical y de ancho completo. */
  variant?: 'inline'
  hint?: string
  error?: string
}

export function Select({
  label,
  variant,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const classes =
    `ui-select${variant === 'inline' ? ' ui-select--inline' : ''} ${className}`.trim()
  return (
    <label className={classes}>
      <span className="ui-select-label">{label}</span>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </select>
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
    </label>
  )
}
