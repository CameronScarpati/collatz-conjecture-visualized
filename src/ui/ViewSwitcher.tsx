import { VIEWS, type ViewId } from '../config.ts'

/*
 * Visually hidden radios rather than ARIA tabs: the radio group brings
 * arrow-key navigation and checked semantics for free, and the selection
 * mirrors into the location hash for shareable deep links.
 */

interface ViewSwitcherProps {
  active: ViewId
  onChange: (view: ViewId) => void
}

export function ViewSwitcher({ active, onChange }: ViewSwitcherProps) {
  return (
    <nav className="view-switcher" aria-label="Visualization">
      <div className="segmented">
        {VIEWS.map((view) => (
          <label key={view.id}>
            <input
              type="radio"
              name="view"
              checked={active === view.id}
              onChange={() => onChange(view.id)}
            />
            <span>{view.label}</span>
          </label>
        ))}
      </div>
    </nav>
  )
}
