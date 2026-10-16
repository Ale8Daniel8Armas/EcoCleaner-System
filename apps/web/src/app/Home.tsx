import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Field,
  Spinner,
  IconMail,
  IconLock,
  IconSpray,
  IconShieldCheck,
  IconUsers,
} from '../components/ui'
import logo from '../assets/ecoapp_logo.svg'
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
    <div className="login-split-shell">
      {/* Columna Izquierda: Panel Hero / Marca */}
      <section className="login-hero-panel">
        <div className="login-brand-top">
          <img className="login-brand-logo" src={logo} alt="EcoCleaner App" />
          <span className="login-brand-name">EcoCleaner System</span>
        </div>

        <div className="login-hero-center">
          <h1 className="login-hero-title">
            Control técnico de<br />
            limpieza
          </h1>
          <p className="login-hero-subtitle">
            Registro, revisión y documentación de tareas, productos y dosificaciones en un solo lugar.
          </p>
        </div>
      </section>

      {/* Columna Derecha: Formulario y Acceso */}
      <section className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-header-group">
            <h2 className="login-header-title">
              {modo === 'login' ? 'Acceso al sistema' : 'Crear nuevo usuario'}
            </h2>
            <p className="login-header-desc">
              {modo === 'login'
                ? 'Ingresa con tu cuenta de perfil según corresponda para acceder al panel correspondiente.'
                : 'Registra una nueva cuenta de acceso con el rol asignado en la planta.'}
            </p>
          </div>

          <div className="login-card-container">
            {errorMsg && (
              <div className="auth-alert-wrap" style={{ marginBottom: '16px' }}>
                <Alert tone="error">{errorMsg}</Alert>
              </div>
            )}

            {successMsg && (
              <div className="auth-alert-wrap" style={{ marginBottom: '16px' }}>
                <Alert tone="success">{successMsg}</Alert>
              </div>
            )}

            {modo === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <Field
                  id="auth-identificador"
                  label="Correo o nombre de usuario"
                  placeholder="ej. operario o supervisor@ecocleaner.com"
                  icon={<IconMail size={17} />}
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  autoComplete="username"
                  required
                />

                <Field
                  id="auth-contrasena"
                  label="Contraseña"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  icon={<IconLock size={17} />}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="submit"
                  className="login-primary-btn"
                  disabled={cargando}
                >
                  {cargando ? (
                    <>
                      <Spinner label="Cargando..." /> Verificando credenciales...
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>

                {/* Cuentas registradas de prueba */}
                <div className="login-quick-section">
                  <p className="login-quick-title">CUENTAS REGISTRADAS DE PRUEBA</p>
                  <div className="login-quick-grid">
                    <button
                      type="button"
                      className="login-quick-card"
                      onClick={() => aplicarCredencialesDemo('operario', 'operario123')}
                    >
                      <span className="login-quick-card-icon">
                        <IconSpray size={19} />
                      </span>
                      <div>
                        <strong className="login-quick-card-title">Operario</strong>
                        <small className="login-quick-card-sub">operario / operario123</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="login-quick-card"
                      onClick={() => aplicarCredencialesDemo('revisor', 'revisor123')}
                    >
                      <span className="login-quick-card-icon">
                        <IconShieldCheck size={19} />
                      </span>
                      <div>
                        <strong className="login-quick-card-title">Revisor</strong>
                        <small className="login-quick-card-sub">revisor / revisor123</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="login-quick-card"
                      onClick={() => aplicarCredencialesDemo('supervisor', 'supervisor123')}
                    >
                      <span className="login-quick-card-icon">
                        <IconUsers size={19} />
                      </span>
                      <div>
                        <strong className="login-quick-card-title">Supervisor</strong>
                        <small className="login-quick-card-sub">supervisor / supervisor123</small>
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
                    icon={<IconMail size={16} />}
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
                  icon={<IconLock size={16} />}
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
                        <strong>Operario</strong>
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
                        <strong>Revisor</strong>
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
                        <strong>Supervisor</strong>
                        <small>Panel general, trazabilidad y configuración técnica.</small>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-primary-btn"
                  disabled={cargando}
                >
                  {cargando ? (
                    <>
                      <Spinner label="Cargando..." /> Registrando en tabla usuarios...
                    </>
                  ) : (
                    'Crear usuario y acceder'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
