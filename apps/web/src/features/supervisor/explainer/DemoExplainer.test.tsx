import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DemoAnswer, DemoErrorBoundary, DemoExplainer } from './DemoExplainer'
import { prepareDemoView } from './view'
import { demoSnapshot } from './fixtures'
import type { DemoSnapshot } from './contracts'

vi.mock('../../../services/supervisor', () => ({
  obtenerDatosExplicadorSupervisor: vi.fn(),
}))

describe('interfaz del explicador', () => {
  it('solo renderiza el botón para supervisor y modo demo', () => {
    expect(
      renderToStaticMarkup(<DemoExplainer role="supervisor" mode="demo" />),
    ).toContain('Explicar resultados (demo)')
    for (const role of ['operario', 'revisor', null])
      expect(
        renderToStaticMarkup(<DemoExplainer role={role} mode="demo" />),
      ).toBe('')
    expect(
      renderToStaticMarkup(<DemoExplainer role="supervisor" mode="off" />),
    ).toBe('')
    expect(
      renderToStaticMarkup(<DemoExplainer role="supervisor" mode="real" />),
    ).toBe('')
  })
  it('conserva el botón accesible y enlazado al panel', () => {
    const html = renderToStaticMarkup(
      <DemoExplainer role="supervisor" mode="demo" />,
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="demo-explainer-panel"')
    expect(html).not.toContain('<input')
  })
  it('renderiza exactamente cuatro secciones y escapa HTML como texto', () => {
    const html = renderToStaticMarkup(
      <DemoAnswer
        answer={{
          summary: '<img src=x onerror=alert(1)>',
          evidence: '<script>example()</script>',
          preliminaryRecommendation: 'Revisión humana.',
          limitations: 'Sin HTML interpretado.',
        }}
      />,
    )
    expect(html.match(/<h4>/g)).toHaveLength(4)
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
  })
  it('convierte excepciones de datos en un estado de error controlado', () => {
    expect(prepareDemoView(null as unknown as DemoSnapshot, 'period')).toEqual({
      error: true,
    })
    expect(prepareDemoView(demoSnapshot(), 'period').error).toBe(false)
  })
  it('incluye una barrera de errores de renderizado independiente del panel supervisor', () => {
    expect(DemoErrorBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    })
    const boundary = new DemoErrorBoundary({ children: 'panel' })
    boundary.state = { failed: true }
    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('role="alert"')
    expect(html).toContain('panel supervisor continúa disponible')
  })
})
