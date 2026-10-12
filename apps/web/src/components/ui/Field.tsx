import type { InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
}

export function Field({ label, id, hint, error, ...props }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-field-label">{label}</span>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
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
