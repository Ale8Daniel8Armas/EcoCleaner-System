type SpinnerProps = {
  label?: string
}

export function Spinner({ label = 'Cargando' }: SpinnerProps) {
  return (
    <span className="ui-spinner" role="status" aria-label={label}>
      <span className="ui-spinner__circle" aria-hidden="true" />
    </span>
  )
}
