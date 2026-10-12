import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

/** Migas de ubicación ("Operario / Registro"). Local al operario. */
export function RouteBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Ubicación">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.label}>
              {item.to && !isLast ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
