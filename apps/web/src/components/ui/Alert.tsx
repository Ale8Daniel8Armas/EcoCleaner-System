import type { HTMLAttributes, PropsWithChildren } from 'react'

type AlertProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
}

export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
  ...props
}: AlertProps) {
  const role = tone === 'error' || tone === 'warning' ? 'alert' : 'status'
  return (
    <div
      className={`ui-alert ui-alert-${tone} ${className}`}
      role={role}
      {...props}
    >
      {title && <strong className="ui-alert-title">{title}</strong>}
      {children && <span className="ui-alert-body">{children}</span>}
    </div>
  )
}
