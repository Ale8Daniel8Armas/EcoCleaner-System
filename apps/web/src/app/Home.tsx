import { Link } from 'react-router-dom'

const roles = [
  {
    to: '/operario',
    icon: '🧹',
    title: 'Operario',
    description:
      'Prepara la receta, registra el uso real y evalúa el criterio de limpieza.',
  },
  {
    to: '/supervisor',
    icon: '📊',
    title: 'Supervisor',
    description:
      'Configura sitios, revisa el panel, compara variantes y genera el reporte.',
  },
]

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand-lockup">
          <span className="brand-mark">EC</span>
          <div>
            <p className="eyebrow">Hackatón Expo Clean 2026</p>
            <h1>EcoCleaner</h1>
          </div>
        </div>
        <span className="simulated-badge">
          <span className="status-dot" /> Datos simulados
        </span>
      </header>

      <main className="landing-main">
        <p className="section-kicker">Selecciona tu rol</p>
        <h2 className="landing-title">¿Cómo vas a usar EcoCleaner?</h2>
        <p className="muted">
          Prototipo funcional. No hay inicio de sesión: elige operario o
          supervisor.
        </p>

        <div className="role-grid">
          {roles.map((role) => (
            <Link className="role-card" key={role.to} to={role.to}>
              <span className="role-icon" aria-hidden="true">
                {role.icon}
              </span>
              <strong>{role.title}</strong>
              <span className="muted">{role.description}</span>
              <span className="role-cta">Entrar →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
