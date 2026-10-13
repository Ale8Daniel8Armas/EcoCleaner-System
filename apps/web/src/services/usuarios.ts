import { isSupabaseConfigured, supabase } from './supabase'

export type RolUsuario = 'operario' | 'supervisor'

export interface Usuario {
  id: string
  email: string
  username: string
  rol: RolUsuario
  nombre: string
  created_at: string
}

export interface NuevoUsuario {
  email: string
  username: string
  password: string
  rol: RolUsuario
  nombre: string
}

const STORAGE_USERS_KEY = 'ecocleaner:usuarios'
const STORAGE_SESSION_KEY = 'ecocleaner:auth_user'

const USUARIOS_DEFAULT: (Usuario & { password_hash: string })[] = [
  {
    id: 'usr-operario-default',
    email: 'operario@ecocleaner.com',
    username: 'operario',
    password_hash: 'operario123',
    rol: 'operario',
    nombre: 'Operario Principal',
    created_at: '2026-10-13T00:00:00Z',
  },
  {
    id: 'usr-supervisor-default',
    email: 'supervisor@ecocleaner.com',
    username: 'supervisor',
    password_hash: 'supervisor123',
    rol: 'supervisor',
    nombre: 'Supervisor de Planta',
    created_at: '2026-10-13T00:00:00Z',
  },
]

function getLocalUsers(): (Usuario & { password_hash: string })[] {
  if (typeof localStorage === 'undefined') return USUARIOS_DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USUARIOS_DEFAULT))
      return USUARIOS_DEFAULT
    }
    const list = JSON.parse(raw)
    return Array.isArray(list) && list.length > 0 ? list : USUARIOS_DEFAULT
  } catch {
    return USUARIOS_DEFAULT
  }
}

function saveLocalUsers(users: (Usuario & { password_hash: string })[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users))
  } catch {
    // ignorar
  }
}

/**
 * Obtiene el usuario autenticado actualmente en la sesión local.
 */
export function obtenerUsuarioActual(): Usuario | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

/**
 * Guarda el usuario en la sesión activa de localStorage.
 */
export function guardarSesion(usuario: Usuario): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(usuario))
  } catch {
    // ignorar
  }
}

/**
 * Cierra la sesión activa actual.
 */
export function cerrarSesion(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY)
  } catch {
    // ignorar
  }
}

/**
 * Inicia sesión verificando credenciales en Supabase o en el almacén local.
 */
export async function iniciarSesion(
  identificador: string,
  contrasena: string,
): Promise<{ ok: boolean; usuario?: Usuario; error?: string }> {
  const cleanId = identificador.trim().toLowerCase()
  const cleanPass = contrasena.trim()

  if (!cleanId) {
    return { ok: false, error: 'Ingresa tu correo electrónico o nombre de usuario.' }
  }
  if (!cleanPass) {
    return { ok: false, error: 'Ingresa tu contraseña.' }
  }

  // 1. Intentar validar con Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, username, password_hash, rol, nombre, created_at')
        .or(`email.ilike.${cleanId},username.ilike.${cleanId}`)
        .limit(1)

      if (!error && data && data.length > 0) {
        const row = data[0]
        if (row.password_hash === cleanPass) {
          const usuario: Usuario = {
            id: row.id,
            email: row.email,
            username: row.username,
            rol: row.rol,
            nombre: row.nombre,
            created_at: row.created_at,
          }
          guardarSesion(usuario)
          return { ok: true, usuario }
        } else {
          return { ok: false, error: 'Contraseña incorrecta.' }
        }
      }
    } catch {
      // Continuar con fallback local
    }
  }

  // 2. Fallback a usuarios locales
  const locales = getLocalUsers()
  const encontrado = locales.find(
    (u) =>
      u.email.toLowerCase() === cleanId ||
      u.username.toLowerCase() === cleanId,
  )

  if (!encontrado) {
    return {
      ok: false,
      error: 'Usuario o correo no encontrado. Puedes registrar uno nuevo.',
    }
  }

  if (encontrado.password_hash !== cleanPass) {
    return { ok: false, error: 'Contraseña incorrecta.' }
  }

  const usuario: Usuario = {
    id: encontrado.id,
    email: encontrado.email,
    username: encontrado.username,
    rol: encontrado.rol,
    nombre: encontrado.nombre,
    created_at: encontrado.created_at,
  }

  guardarSesion(usuario)
  return { ok: true, usuario }
}

/**
 * Crea y almacena un nuevo usuario en la tabla de usuarios de Supabase y/o almacén local.
 */
export async function crearUsuario(
  input: NuevoUsuario,
): Promise<{ ok: boolean; usuario?: Usuario; error?: string }> {
  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase().replace(/\s+/g, '_')
  const nombre = input.nombre.trim()
  const password = input.password.trim()
  const rol = input.rol

  if (!nombre) {
    return { ok: false, error: 'El nombre completo es obligatorio.' }
  }
  if (!username || username.length < 3) {
    return { ok: false, error: 'El nombre de usuario debe tener al menos 3 caracteres.' }
  }
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Ingresa un correo electrónico válido.' }
  }
  if (!password || password.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' }
  }
  if (rol !== 'operario' && rol !== 'supervisor') {
    return { ok: false, error: 'Selecciona un rol válido (Operario o Supervisor).' }
  }

  // 1. Guardar en Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .insert({
          email,
          username,
          password_hash: password,
          rol,
          nombre,
        })
        .select('id, email, username, rol, nombre, created_at')
        .single()

      if (!error && data) {
        const usuario: Usuario = {
          id: data.id,
          email: data.email,
          username: data.username,
          rol: data.rol,
          nombre: data.nombre,
          created_at: data.created_at,
        }

        // Sincronizar también a local para disponibilidad offline
        const locales = getLocalUsers()
        locales.push({ ...usuario, password_hash: password })
        saveLocalUsers(locales)

        guardarSesion(usuario)
        return { ok: true, usuario }
      }

      if (error && error.code === '23505') {
        return { ok: false, error: 'Ya existe un usuario con ese correo o nombre de usuario.' }
      }
    } catch {
      // Continuar con fallback local
    }
  }

  // 2. Almacenamiento local
  const locales = getLocalUsers()
  if (
    locales.some(
      (u) =>
        u.email.toLowerCase() === email ||
        u.username.toLowerCase() === username,
    )
  ) {
    return {
      ok: false,
      error: 'Ya existe un usuario local registrado con ese correo o usuario.',
    }
  }

  const nuevo: Usuario & { password_hash: string } = {
    id: `usr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    email,
    username,
    password_hash: password,
    rol,
    nombre,
    created_at: new Date().toISOString(),
  }

  locales.push(nuevo)
  saveLocalUsers(locales)

  const usuario: Usuario = {
    id: nuevo.id,
    email: nuevo.email,
    username: nuevo.username,
    rol: nuevo.rol,
    nombre: nuevo.nombre,
    created_at: nuevo.created_at,
  }

  guardarSesion(usuario)
  return { ok: true, usuario }
}

/**
 * Consulta la lista de todos los usuarios registrados.
 */
export async function listarUsuarios(): Promise<Usuario[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, username, rol, nombre, created_at')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        return data as Usuario[]
      }
    } catch {
      // fallback
    }
  }

  return getLocalUsers().map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    rol: u.rol,
    nombre: u.nombre,
    created_at: u.created_at,
  }))
}
