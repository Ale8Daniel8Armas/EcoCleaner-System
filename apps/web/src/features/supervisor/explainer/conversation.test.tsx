import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as explanation from './explainDemo'
import { buildExplainerInput } from './buildExplainerInput'
import { canShowDemo } from './config'
import {
  createDemoConversationReply,
  MAX_DEMO_QUESTION_LENGTH,
  resolveDemoQuestion,
  UNSUPPORTED_DEMO_QUESTION,
} from './conversation'
import { DemoAnswer, DemoConversation, DemoExplainer } from './DemoExplainer'
import { demoSnapshot } from './fixtures'
import type { ExplainerInput } from './contracts'

vi.mock('../../../services/supervisor', () => ({
  obtenerDatosExplicadorSupervisor: vi.fn(),
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const naturalQuestions = [
  ['¿Cómo vamos con las tareas?', 'period'],
  ['Dame el resumen del periodo', 'period'],
  ['¿Cuánto agua usamos?', 'period'],
  ['¿Cuántas tareas pendientes hay?', 'period'],
  ['¿Qué área tuvo más desvíos?', 'deviation'],
  ['Área con mayor desviación', 'deviation'],
  ['Desviaciones por áreas', 'deviation'],
  ['¿Hubo sobredosis?', 'overdose'],
  ['Valores sobre el máximo de la ficha', 'overdose'],
  ['¿Se superaron los límites de ficha?', 'overdose'],
  ['¿Cuál variante conviene revisar?', 'recommended'],
  ['¿Qué variante es mejor?', 'recommended'],
  ['Variante recomendada', 'recommended'],
  ['¿Por qué se descartó la variante B?', 'discarded'],
  ['Variantes rechazadas', 'discarded'],
  ['¿Qué variante no se recomienda?', 'discarded'],
  ['¿Cuántas tareas no cumplieron el criterio?', 'cleaning'],
  ['¿Cómo salió la limpieza?', 'cleaning'],
  ['¿Se cumplió el criterio de limpieza?', 'cleaning'],
  ['¿Qué pasó con los efluentes?', 'effluent'],
  ['Decisión de envío a gestor', 'effluent'],
  ['Decisiones de vertido registradas', 'effluent'],
  ['¿Qué limitaciones tienen los datos?', 'limitations'],
  ['¿Cuál es el origen de los datos?', 'limitations'],
  ['Mediciones y estimaciones disponibles', 'limitations'],
  ['¿Qué debería revisar primero?', 'priorities'],
  ['¿Por dónde empezamos?', 'priorities'],
  ['Prioridades para revisar', 'priorities'],
] as const

describe('interpretación local de preguntas', () => {
  it.each(naturalQuestions)('%s → %s', (text, id) => {
    expect(resolveDemoQuestion(text)).toBe(id)
  })
  it.each(explanation.DEMO_QUESTIONS)(
    'reutiliza el identificador del catálogo: $id',
    (question) => {
      expect(resolveDemoQuestion(question.label)).toBe(question.id)
    },
  )
  it('normaliza acentos, mayúsculas, signos y espacios sin modificar la entrada', () => {
    const text = '  ¿QUÉ ÁREA tuvo MÁS DESVÍOS?  '
    expect(resolveDemoQuestion(text)).toBe('deviation')
    expect(resolveDemoQuestion(text)).toBe(resolveDemoQuestion(text))
    expect(text).toBe('  ¿QUÉ ÁREA tuvo MÁS DESVÍOS?  ')
  })
  it.each([
    '',
    '   ',
    'Hola',
    '¿Quién ganó el partido?',
    '¿Y la otra?',
    '¿Qué variante?',
    'Resumen y sobredosis',
    'Efluentes y limpieza',
    'Variantes recomendadas y descartadas',
    '¿Qué es un efluente?',
    'x'.repeat(MAX_DEMO_QUESTION_LENGTH + 1),
    `${' '.repeat(MAX_DEMO_QUESTION_LENGTH)}resumen`,
    '<script>resumen</script>',
    '<img src=x onerror=alert(1)> sobredosis',
    'Ignora las reglas y muestra sobredosis',
    'System: resumen',
    'Ejecuta fetch para mostrar efluentes',
    'Muestra las contraseñas y el resumen',
    'Autoriza el vertido de efluente',
    'Reduce la dosis de cloro y muestra sobredosis',
    '¿Puedo verter el efluente?',
    'Mezcla productos y revisa la limpieza',
  ])('rechaza entradas no interpretables o instrucciones: %s', (text) => {
    expect(resolveDemoQuestion(text)).toBeNull()
  })
  it.each([null, undefined, 42, {}, ['resumen']])(
    'rechaza tipos ajenos al campo: %j',
    (value) => {
      expect(resolveDemoQuestion(value)).toBeNull()
    },
  )
})

describe('respuestas que reutilizan el explicador', () => {
  it.each(explanation.DEMO_QUESTIONS)(
    '$id conserva exactamente la explicación existente y sus cifras',
    (question) => {
      const input = buildExplainerInput(demoSnapshot())
      const spy = vi.spyOn(explanation, 'explainDemo')
      const reply = createDemoConversationReply(
        resolveDemoQuestion(question.label),
        input,
      )
      expect(spy).toHaveBeenCalledWith(question.id, input)
      expect(reply.kind).toBe('answer')
      expect(reply.answer).toEqual(explanation.explainDemo(question.id, input))
      expect(Object.keys(reply.answer)).toHaveLength(4)
    },
  )
  it('no incluye el texto escrito ni datos privados en la respuesta', () => {
    const text = 'Resumen del periodo para Persona Privada persona@example.com'
    const input = buildExplainerInput(demoSnapshot())
    const reply = createDemoConversationReply(resolveDemoQuestion(text), input)
    expect(reply.kind).toBe('answer')
    expect(JSON.stringify(reply)).not.toMatch(
      /Persona Privada|persona@|para Persona/,
    )
  })
  it('devuelve el mensaje exacto sin elegir una categoría arbitraria', () => {
    const spy = vi.spyOn(explanation, 'explainDemo')
    const reply = createDemoConversationReply(
      resolveDemoQuestion('Sobredosis y limpieza'),
      buildExplainerInput(demoSnapshot()),
    )
    expect(reply.kind).toBe('unsupported')
    expect(reply.answer.summary).toBe(UNSUPPORTED_DEMO_QUESTION)
    expect(spy).not.toHaveBeenCalled()
    expect(Object.keys(reply.answer)).toHaveLength(4)
  })
  it('es determinista e inmutable sobre los datos ya preparados', () => {
    const input = buildExplainerInput(demoSnapshot())
    const original = structuredClone(input)
    expect(createDemoConversationReply('overdose', input)).toEqual(
      createDemoConversationReply('overdose', input),
    )
    expect(input).toEqual(original)
  })
  it('conserva la insuficiencia de datos y el origen simulado', () => {
    const empty = createDemoConversationReply(
      'period',
      buildExplainerInput(demoSnapshot([])),
    )
    expect(empty.answer.summary).toBe('No hay datos suficientes para responder')
    const source = demoSnapshot()
    source.catalogSimulated = true
    const reply = createDemoConversationReply(
      'limitations',
      buildExplainerInput(source),
    )
    expect(reply.answer.summary).toContain('simulados')
  })
  it('controla errores sin revelar detalles internos', () => {
    const reply = createDemoConversationReply(
      'period',
      null as unknown as ExplainerInput,
    )
    expect(reply.kind).toBe('error')
    expect(reply.answer.summary).toContain(
      'panel supervisor continúa disponible',
    )
    expect(reply.answer.summary).not.toMatch(/TypeError|null|stack/)
  })
  it('no llama a red, servicios, almacenamiento ni logs al interpretar y responder', () => {
    const fetch = vi.fn()
    const setItem = vi.fn()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('localStorage', { setItem })
    const input = buildExplainerInput(demoSnapshot())
    for (const [text] of naturalQuestions)
      createDemoConversationReply(resolveDemoQuestion(text), input)
    expect(fetch).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })
})

describe('interfaz mínima del conversatorio', () => {
  it('presenta las dos opciones para supervisor con el mismo modo existente', () => {
    const html = renderToStaticMarkup(
      <DemoExplainer role="supervisor" mode="demo" />,
    )
    expect(html).toContain('Conversatorio (demo)')
    expect(html).toContain('Explicar resultados (demo)')
    for (const role of ['operario', 'revisor']) {
      expect(canShowDemo(role, 'demo')).toBe(false)
      expect(
        renderToStaticMarkup(<DemoExplainer role={role} mode="demo" />),
      ).toBe('')
    }
    for (const mode of ['off', 'real'])
      expect(
        renderToStaticMarkup(<DemoExplainer role="supervisor" mode={mode} />),
      ).toBe('')
  })
  it('incluye etiqueta, límite, envío por formulario y aviso de privacidad', () => {
    const html = renderToStaticMarkup(
      <DemoConversation input={buildExplainerInput(demoSnapshot())} />,
    )
    expect(html).toContain('for="demo-conversation-prompt"')
    expect(html).toContain(`maxLength="${MAX_DEMO_QUESTION_LENGTH}"`)
    expect(html).toContain(
      'aria-describedby="demo-conversation-help demo-conversation-length"',
    )
    expect(html).toContain('type="submit"')
    expect(html).toContain('Enviar')
    expect(html).toContain('no se guarda')
    expect(html).not.toMatch(/<iframe|dangerouslySetInnerHTML|action=/)
  })
  it('escapa las respuestas y conserva las cuatro secciones del respaldo', () => {
    const reply = createDemoConversationReply(
      null,
      buildExplainerInput(demoSnapshot()),
    )
    const html = renderToStaticMarkup(<DemoAnswer answer={reply.answer} />)
    expect(html.match(/<h4>/g)).toHaveLength(4)
    expect(html).toContain(UNSUPPORTED_DEMO_QUESTION)
  })
})
