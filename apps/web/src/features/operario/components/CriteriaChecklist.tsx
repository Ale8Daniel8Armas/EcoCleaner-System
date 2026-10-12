interface ChecklistItem {
  criterio: string
  cumple: boolean
}

interface CriteriaChecklistProps {
  items: ChecklistItem[]
  onChange: (index: number, cumple: boolean) => void
}

/** Checklist cumple / no cumple (RF-07). Local al operario; se promueve si se reutiliza. */
export function CriteriaChecklist({ items, onChange }: CriteriaChecklistProps) {
  return (
    <ul className="criteria-list">
      {items.map((item, index) => (
        <li
          className={`criteria-item ${item.cumple ? 'is-ok' : 'is-fail'}`}
          key={item.criterio}
        >
          <span className="criteria-text">{item.criterio}</span>
          <div
            className="criteria-toggle"
            role="group"
            aria-label={item.criterio}
          >
            <button
              type="button"
              className={`criteria-choice ${item.cumple ? 'selected' : ''}`}
              aria-pressed={item.cumple}
              onClick={() => onChange(index, true)}
            >
              Cumple
            </button>
            <button
              type="button"
              className={`criteria-choice ${!item.cumple ? 'selected' : ''}`}
              aria-pressed={!item.cumple}
              onClick={() => onChange(index, false)}
            >
              No cumple
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
