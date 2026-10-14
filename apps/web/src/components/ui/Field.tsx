import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  icon?: ReactNode
}

export function Field({ label, id, hint, error, icon, className = '', ...props }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <label className={`ui-field ${icon ? 'ui-field--has-icon' : ''} ${className}`} htmlFor={id}>
      <span className="ui-field-label">{label}</span>
      <div className="ui-field-input-box">
        {icon && <span className="ui-field-prefix-icon" aria-hidden="true">{icon}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
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
    </label>
  )
}
