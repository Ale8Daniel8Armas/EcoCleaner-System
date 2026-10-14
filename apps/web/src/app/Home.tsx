import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field, Spinner } from '../components/ui'
import {
  crearUsuario,
  iniciarSesion,
  type RolUsuario,
} from '../services/usuarios'

export default function Home() {
  const navigate = useNavigate()

  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [identificador, setIdentificador] = useState('')
  const [contrasena, setContrasena] = useState('')

  // Campos para nuevo usuario
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [nuevoRol, setNuevoRol] = useState<RolUsuario>('operario')

  const [cargando, setCargando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setCargando(true)

    try {
      const res = await iniciarSesion(identificador, contrasena)
      if (!res.ok || !res.usuario) {
        setErrorMsg(res.error || 'Credenciales inválidas.')
        setCargando(false)
        return
      }

      setSuccessMsg(`¡Bienvenido, ${res.usuario.nombre}! Redirigiendo...`)
      setTimeout(() => {
        if (res.usuario?.rol === 'supervisor') {
          navigate('/supervisor')
        } else if (res.usuario?.rol === 'revisor') {
          navigate('/revisor')
        } else {
          navigate('/operario')
        }
      }, 600)
    } catch {
      setErrorMsg('Ocurrió un error inesperado al intentar iniciar sesión.')
      setCargando(false)
    }
  }

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setCargando(true)

    try {
      const res = await crearUsuario({
        nombre: nuevoNombre,
        username: nuevoUsername,
        email: nuevoEmail,
        password: nuevaContrasena,
        rol: nuevoRol,
      })

      if (!res.ok || !res.usuario) {
        setErrorMsg(res.error || 'No se pudo crear el usuario.')
        setCargando(false)
        return
      }

      setSuccessMsg(`Usuario ${res.usuario.username} creado exitosamente con rol ${res.usuario.rol}. Redirigiendo...`)
      setTimeout(() => {
        if (res.usuario?.rol === 'supervisor') {
          navigate('/supervisor')
        } else if (res.usuario?.rol === 'revisor') {
          navigate('/revisor')
        } else {
          navigate('/operario')
        }
      }, 700)
    } catch {
      setErrorMsg('Ocurrió un error al crear el usuario en la base de datos.')
      setCargando(false)
    }
  }

  const aplicarCredencialesDemo = (id: string, pass: string) => {
    setModo('login')
    setIdentificador(id)
    setContrasena(pass)
    setErrorMsg(null)
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand-lockup">
          <span className="brand-mark">EC</span>
          <h1>EcoCleaner System</h1>
        </div>
      </header>

      <main className="landing-main auth-main-wrap">
        <div className="auth-header-section">
          <h1>Acceso al Sistema</h1>
          <p className="muted">
            Ingresa con tu cuenta de perfil según corresponda para acceder al panel correspondiente.
          </p>
        </div>

        <Card className="auth-card">
          {errorMsg && (
            <div className="auth-alert-wrap">
              <Alert tone="error">{errorMsg}</Alert>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert-wrap">
              <Alert tone="success">{successMsg}</Alert>
            </div>
          )}

          {modo === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              {/* Field arriba: Correo / Usuario */}
              <Field
                id="auth-identificador"
                label="Correo o nombre de usuario"
                placeholder="ej. operario o supervisor@ecocleaner.com"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                autoComplete="username"
                required
              />

              {/* Field abajo: Contraseña */}
              <Field
                id="auth-contrasena"
                label="Contraseña"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                required
              />

              {/* Botón para acceder o iniciar sesión */}
              <Button
                type="submit"
                className="full-button auth-submit-btn"
                disabled={cargando}
              >
                {cargando ? (
                  <>
                    <Spinner label="Cargando..." /> Verificando credenciales...
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>

              {/* Credenciales de demostración de acceso rápido */}
              <div className="auth-quick-access">
                <p className="auth-quick-title">Cuentas registradas de prueba:</p>
                <div className="auth-quick-badges">
                  <button
                    type="button"
                    className="quick-badge-btn"
                    onClick={() => aplicarCredencialesDemo('operario', 'operario123')}
                  >
                    <span>🧹</span>
                    <div>
                      <strong>Operario</strong>
                      <small>operario / operario123</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="quick-badge-btn"
                    onClick={() => aplicarCredencialesDemo('revisor', 'revisor123')}
                  >
                    <span>🔍</span>
                    <div>
                      <strong>Revisor</strong>
                      <small>revisor / revisor123</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="quick-badge-btn"
                    onClick={() => aplicarCredencialesDemo('supervisor', 'supervisor123')}
                  >
                    <span>📊</span>
                    <div>
                      <strong>Supervisor</strong>
                      <small>supervisor / supervisor123</small>
                    </div>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegistro}>
              <Field
                id="reg-nombre"
                label="Nombre completo"
                placeholder="ej. Carlos Mendoza"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                required
              />

              <div className="auth-form-row">
                <Field
                  id="reg-username"
                  label="Nombre de usuario"
                  placeholder="ej. cmendoza"
                  value={nuevoUsername}
                  onChange={(e) => setNuevoUsername(e.target.value)}
                  required
                />
                <Field
                  id="reg-email"
                  label="Correo electrónico"
                  type="email"
                  placeholder="cmendoza@ecocleaner.com"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  required
                />
              </div>

              <Field
                id="reg-password"
                label="Contraseña"
                type="password"
                placeholder="Mínimo 4 caracteres"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                required
              />

              <div className="auth-role-select-group">
                <span className="ui-field-label">Rol del usuario en EcoCleaner:</span>
                <div className="auth-role-options">
                  <label className={`auth-role-option ${nuevoRol === 'operario' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="rol"
                      value="operario"
                      checked={nuevoRol === 'operario'}
                      onChange={() => setNuevoRol('operario')}
                    />
                    <div className="role-option-text">
                      <strong>🧹 Operario</strong>
                      <small>Prepara recetas y declara cantidades usadas.</small>
                    </div>
                  </label>

                  <label className={`auth-role-option ${nuevoRol === 'revisor' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="rol"
                      value="revisor"
                      checked={nuevoRol === 'revisor'}
                      onChange={() => setNuevoRol('revisor')}
                    />
                    <div className="role-option-text">
                      <strong>🔍 Revisor</strong>
                      <small>Valida en 3 pasos: uso real, criterio y efluente.</small>
                    </div>
                  </label>

                  <label className={`auth-role-option ${nuevoRol === 'supervisor' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="rol"
                      value="supervisor"
                      checked={nuevoRol === 'supervisor'}
                      onChange={() => setNuevoRol('supervisor')}
                    />
                    <div className="role-option-text">
                      <strong>📊 Supervisor</strong>
                      <small>Panel general, trazabilidad y configuración técnica.</small>
                    </div>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="full-button auth-submit-btn"
                disabled={cargando}
              >
                {cargando ? (
                  <>
                    <Spinner label="Cargando..." /> Registrando en tabla usuarios...
                  </>
                ) : (
                  'Crear usuario y acceder →'
                )}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  )
}
