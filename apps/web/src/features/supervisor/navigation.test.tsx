import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import MobileLayout from '../../app/MobileLayout'
import { SupervisorSidebar } from './components/SupervisorSidebar'
import SupervisorHome from './pages/SupervisorHome'
import LlmAssistant from './pages/LlmAssistant'
import { DemoAnswer } from './explainer/DemoExplainer'
import { buildExplainerInput } from './explainer/buildExplainerInput'
import { DEMO_QUESTIONS, explainDemo } from './explainer/explainDemo'
import { demoSnapshot, demoTask } from './explainer/fixtures'

const { currentUser, loadExplanation } = vi.hoisted(() => ({
  currentUser: vi.fn(),
  loadExplanation: vi.fn(),
}))

vi.mock('../../services/usuarios', () => ({
  obtenerUsuarioActual: currentUser,
  cerrarSesion: vi.fn(),
}))
vi.mock('../../services/supervisor', () => ({
  obtenerDatosExplicadorSupervisor: loadExplanation,
  obtenerConsumoSupervisor: vi.fn(),
  obtenerResumenSupervisor: vi.fn(),
}))

const renderAt = (element: ReactNode, path = '/supervisor') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_LLM_MODE', 'demo')
  currentUser.mockReturnValue({ rol: 'supervisor' })
})
afterEach(() => vi.unstubAllEnvs())

describe('navegación independiente del supervisor', () => {
  it('ofrece Groq solo en desarrollo local, sin selector de escenarios y conserva el acceso al demo', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_LOCAL_LLM', 'true')
    const html = renderAt(<LlmAssistant />, '/supervisor/asistente')
    expect(html).toContain('Asistente EcoCleaner')
    expect(html).toContain('Evaluación local')
    expect(html).toContain('Las explicaciones requieren revisión humana')
    expect(html).toContain('Datos y sesión')
    expect(html).toContain('aria-describedby="live-input-help"')
    expect(html).not.toContain('Contexto general de EcoCleaner')
    expect(html).toContain('Ver modo demostración')
    expect(html).not.toContain('<select')
    expect(renderAt(<SupervisorSidebar />)).toContain(
      'Asistente LLM (Groq local)',
    )
  })
  it('una marca de entorno de Groq no habilita la conexión local en un build de producción', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_LOCAL_LLM', 'true')
    const html = renderAt(<LlmAssistant />, '/supervisor/asistente')
    expect(html).toContain('Modo demostración')
    expect(html).not.toContain('Enviar a Groq')
    expect(html).not.toContain('Contexto general de EcoCleaner')
  })
  it('conserva las métricas y enlaces de gestión, sin formularios ni carga del explicador en el Dashboard', () => {
    const html = renderAt(<SupervisorHome />)
    expect(html).toContain('Consumo por área y tarea')
    for (const path of [
      '/supervisor/productos/nuevo',
      '/supervisor/sitios/nuevo',
    ])
      expect(html).toContain(`href="${path}"`)
    expect(html).toContain('Gestión de usuarios')
    expect(html).not.toContain('href="/supervisor/asistente"')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('demo-explainer-panel')
    expect(html).not.toContain('Conversatorio (demo)')
    expect(loadExplanation).not.toHaveBeenCalled()
  })

  it('ubica el asistente debajo de Panel y lo marca activo en el menú de escritorio', () => {
    const html = renderAt(<SupervisorSidebar />, '/supervisor/asistente')
    expect(html).toMatch(
      /<a[^>]*class="sidebar-nav-item is-active"[^>]*aria-current="page"[^>]*href="\/supervisor\/asistente"/,
    )
    expect(html).toContain('Asistente LLM (demo)')
    expect(html).toContain('href="/supervisor/sitios"')
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(links.slice(0, 3)).toEqual([
      '/supervisor',
      '/supervisor/asistente',
      '/supervisor/usuarios',
    ])
  })

  it('incluye el acceso móvil y permite regresar desde la vista del asistente', () => {
    const layout = renderAt(<MobileLayout />, '/supervisor/asistente')
    expect(layout).toMatch(
      /<a[^>]*href="\/supervisor\/asistente"[^>]*>[\s\S]*?<span class="nav-label">LLM demo<\/span>/,
    )
    const page = renderAt(<LlmAssistant />, '/supervisor/asistente')
    expect(page).toContain('<h1>Asistente EcoCleaner</h1>')
    expect(page).toContain('href="/supervisor"')
    expect(page).toContain('Modo demostración')
    expect(page).not.toContain('Datos y sesión')
    expect(page).toContain('role="log"')
    expect(page).toContain('Cargando datos')
  })

  it.each(['off', 'real', ''])(
    'oculta todos los accesos y la vista en modo %s',
    (mode) => {
      vi.stubEnv('VITE_LLM_MODE', mode)
      expect(renderAt(<SupervisorHome />)).not.toContain(
        '/supervisor/asistente',
      )
      expect(renderAt(<MobileLayout />)).not.toContain('/supervisor/asistente')
      expect(renderAt(<SupervisorSidebar />)).not.toContain(
        '/supervisor/asistente',
      )
      expect(renderAt(<LlmAssistant />)).toBe('')
    },
  )

  it.each(['operario', 'revisor'])(
    'no ofrece acceso al LLM al perfil %s',
    (rol) => {
      currentUser.mockReturnValue({ rol })
      expect(renderAt(<MobileLayout />, `/${rol}`)).not.toContain(
        '/supervisor/asistente',
      )
      expect(renderAt(<SupervisorSidebar />)).not.toContain(
        '/supervisor/asistente',
      )
      expect(renderAt(<LlmAssistant />)).toBe('')
    },
  )
})

describe('retiro exclusivamente visual de referencias', () => {
  it.each(DEMO_QUESTIONS)(
    '$id conserva los datos y cuatro secciones, sin desplegable ni códigos completos',
    ({ id }) => {
      const snapshot = demoSnapshot([
        demoTask({
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Actividad simulada de prueba',
          areaName: 'Área de prueba',
        }),
      ])
      const original = structuredClone(snapshot)
      const input = buildExplainerInput(snapshot)
      const references = structuredClone(input.references)
      const html = renderToStaticMarkup(
        <DemoAnswer
          answer={explainDemo(id, input)}
          references={input.references}
        />,
      )
      expect(html.match(/<h4>/g)).toHaveLength(4)
      expect(html).not.toContain('Ver referencias de los registros')
      expect(html).not.toContain('<details')
      expect(html).not.toContain('10000000-0000-4000-8000-000000000001')
      expect(input.references).toEqual(references)
      expect(snapshot).toEqual(original)
      expect(snapshot.tasks).toHaveLength(1)
    },
  )
})
