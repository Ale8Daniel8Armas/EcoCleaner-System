import { buildExplainerInput } from './buildExplainerInput'
import type { DemoSnapshot, ExplainerInput } from './contracts'
import { explainDemo, type DemoQuestionId } from './explainDemo'
import { resolveDemoQuestion } from './conversation'
import type { LiveCatalog } from './live-data'
import { operationalName } from './references'

type Topic =
  | DemoQuestionId
  | 'welcome'
  | 'about'
  | 'workflow'
  | 'roles'
  | 'water'
  | 'product'
  | 'pending'
  | 'catalog'
  | 'compatibility'
  | 'ph'
  | 'effluentPh'
  | 'dilution'
  | 'deviationMeaning'
  | 'overdoseMeaning'
  | 'effluentMeaning'
  | 'measured'
  | 'estimated'
  | 'simulated'
  | 'savings'
  | 'review'
  | 'presentation'
type Group =
  'Para empezar' | 'Resultados' | 'Productos y efluentes' | 'Conceptos'
interface PreparedQuestion {
  id: string
  label: string
  topic: Topic
  group: Group
  chip?: string
}

export const DEMO_CHAT_QUESTIONS: PreparedQuestion[] = [
  {
    id: 'summary',
    label: 'Resume los resultados disponibles.',
    topic: 'period',
    group: 'Para empezar',
    chip: 'Resumen de tareas',
  },
  {
    id: 'priorities',
    label: '¿Qué debería revisar primero y con qué evidencia?',
    topic: 'priorities',
    group: 'Para empezar',
    chip: '¿Qué revisar primero?',
  },
  {
    id: 'overdose',
    label: '¿Hubo sobredosis o valores sobre el máximo de la ficha?',
    topic: 'overdose',
    group: 'Resultados',
    chip: 'Sobredosis y desvíos',
  },
  {
    id: 'recommended',
    label: '¿Qué variante se recomienda y por qué?',
    topic: 'recommended',
    group: 'Resultados',
    chip: 'Comparar procedimientos',
  },
  {
    id: 'incompatible',
    label: '¿Qué productos tienen incompatibilidades documentadas?',
    topic: 'compatibility',
    group: 'Productos y efluentes',
    chip: 'Productos incompatibles',
  },
  {
    id: 'effluent',
    label: '¿Qué sabemos sobre las decisiones de efluente?',
    topic: 'effluent',
    group: 'Productos y efluentes',
    chip: 'Decisiones de efluentes',
  },
  {
    id: 'limitations',
    label: '¿Qué información falta para interpretar estos resultados?',
    topic: 'limitations',
    group: 'Para empezar',
    chip: 'Información que falta',
  },
  {
    id: 'hello',
    label: 'Hola, ¿en qué me puedes ayudar?',
    topic: 'welcome',
    group: 'Para empezar',
  },
  {
    id: 'about',
    label: '¿Qué es EcoCleaner?',
    topic: 'about',
    group: 'Para empezar',
  },
  {
    id: 'workflow',
    label: '¿Cómo funciona el proceso de limpieza en EcoCleaner?',
    topic: 'workflow',
    group: 'Para empezar',
  },
  {
    id: 'roles',
    label: '¿Qué hace cada rol en la aplicación?',
    topic: 'roles',
    group: 'Para empezar',
  },
  {
    id: 'presentation',
    label: 'Dame un resumen para la exposición.',
    topic: 'presentation',
    group: 'Para empezar',
  },
  {
    id: 'status',
    label: '¿Cuántas tareas están completadas y pendientes?',
    topic: 'period',
    group: 'Resultados',
  },
  {
    id: 'water',
    label: '¿Cuánta agua se ha utilizado?',
    topic: 'water',
    group: 'Resultados',
  },
  {
    id: 'product',
    label: '¿Cuánto producto se ha consumido?',
    topic: 'product',
    group: 'Resultados',
  },
  {
    id: 'pending',
    label: '¿Qué tareas están pendientes?',
    topic: 'pending',
    group: 'Resultados',
  },
  {
    id: 'areas',
    label: '¿Qué área presenta mayor desvío frente a la receta?',
    topic: 'deviation',
    group: 'Resultados',
  },
  {
    id: 'discarded',
    label: '¿Qué variantes se descartan y por qué?',
    topic: 'discarded',
    group: 'Resultados',
  },
  {
    id: 'cleaning',
    label: '¿Cuántas tareas no cumplieron el criterio de limpieza?',
    topic: 'cleaning',
    group: 'Resultados',
  },
  {
    id: 'savings',
    label: '¿Podemos afirmar que hubo ahorro de agua o producto?',
    topic: 'savings',
    group: 'Resultados',
  },
  {
    id: 'catalog',
    label: '¿Qué productos hay en el catálogo?',
    topic: 'catalog',
    group: 'Productos y efluentes',
  },
  {
    id: 'compatible',
    label: '¿Qué productos son compatibles?',
    topic: 'compatibility',
    group: 'Productos y efluentes',
  },
  {
    id: 'mixing',
    label: '¿Puedo mezclar los productos de limpieza?',
    topic: 'compatibility',
    group: 'Productos y efluentes',
  },
  {
    id: 'ph',
    label: '¿Qué pH tienen los productos del catálogo?',
    topic: 'ph',
    group: 'Productos y efluentes',
  },
  {
    id: 'effluent-ph',
    label: '¿Cuál es el pH del efluente?',
    topic: 'effluentPh',
    group: 'Productos y efluentes',
  },
  {
    id: 'disposal',
    label: '¿El asistente puede autorizar un vertido?',
    topic: 'effluentMeaning',
    group: 'Productos y efluentes',
  },
  {
    id: 'effluent-meaning',
    label: '¿Qué es un efluente?',
    topic: 'effluentMeaning',
    group: 'Conceptos',
  },
  {
    id: 'dilution',
    label: '¿Qué significa dilución?',
    topic: 'dilution',
    group: 'Conceptos',
  },
  {
    id: 'deviation-meaning',
    label: '¿Qué es el desvío de consumo?',
    topic: 'deviationMeaning',
    group: 'Conceptos',
  },
  {
    id: 'overdose-meaning',
    label: '¿Qué significa sobredosis?',
    topic: 'overdoseMeaning',
    group: 'Conceptos',
  },
  {
    id: 'measured',
    label: '¿Qué significa que un dato sea medido?',
    topic: 'measured',
    group: 'Conceptos',
  },
  {
    id: 'estimated',
    label: '¿Qué significa que un dato sea estimado?',
    topic: 'estimated',
    group: 'Conceptos',
  },
  {
    id: 'simulated',
    label: '¿Qué significa que un dato sea simulado?',
    topic: 'simulated',
    group: 'Conceptos',
  },
  {
    id: 'review',
    label: '¿Por qué las recomendaciones requieren revisión humana?',
    topic: 'review',
    group: 'Conceptos',
  },
]
export const DEMO_CHAT_GROUPS: Group[] = [
  'Para empezar',
  'Resultados',
  'Productos y efluentes',
  'Conceptos',
]
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const analyses = new Set<Topic>([
  'period',
  'priorities',
  'overdose',
  'recommended',
  'discarded',
  'cleaning',
  'effluent',
  'limitations',
  'deviation',
])
export interface PreparedReply {
  topic: Topic | null
  answer: string
  supported: boolean
}

function resolveTopic(question: string, previous: Topic | null): Topic | null {
  const text = normalize(question)
  const exact = DEMO_CHAT_QUESTIONS.find(
    (item) => normalize(item.label) === text,
  )
  if (exact) return exact.topic
  if (
    /^(por que|y por que|explica mejor|dame mas detalle|puedes explicarlo mejor|cuentame mas)$/.test(
      text,
    )
  )
    return previous
  if (
    /^(hola|buenos dias|buenas tardes|buenas noches|buenas|gracias|muchas gracias|hola ecocleaner)$/.test(
      text,
    )
  )
    return 'welcome'
  if (/\b(ecocleaner|que puedes hacer|en que me puedes ayudar)\b/.test(text))
    return /\b(proceso|funciona|flujo)\b/.test(text) ? 'workflow' : 'about'
  if (/\b(exposicion|presentacion|hackaton)\b/.test(text)) return 'presentation'
  if (/\b(rol|roles|supervisor|operario|revisor)\b/.test(text)) return 'roles'
  if (/\b(ph)\b/.test(text))
    return /\befluente\b/.test(text) ? 'effluentPh' : 'ph'
  if (/\b(compatib\w*|incompatib\w*|mezcl\w*)\b/.test(text))
    return 'compatibility'
  if (
    /\b(catalogo|productos disponibles)\b|\bque productos (hay|tenemos)\b/.test(
      text,
    )
  )
    return 'catalog'
  if (/\b(ahorro|ahorramos|ahorrado|ahorrar|costos|coste|dinero)\b/.test(text))
    return 'savings'
  if (/\b(revision humana|responsable|autorizar)\b/.test(text))
    return /\b(vertido|verter|efluente)\b/.test(text)
      ? 'effluentMeaning'
      : 'review'
  if (/\b(que es|que significa|define|significa|diferencia)\b/.test(text)) {
    if (/\bdilucion\b/.test(text)) return 'dilution'
    if (/\bdesvio\b/.test(text)) return 'deviationMeaning'
    if (/\bsobredosis\b/.test(text)) return 'overdoseMeaning'
    if (/\befluente\b/.test(text)) return 'effluentMeaning'
    if (/\bsimulado\b/.test(text)) return 'simulated'
    if (/\bestimado\b/.test(text)) return 'estimated'
    if (/\bmedido\b/.test(text)) return 'measured'
  }
  if (/\b(pendientes?)\b/.test(text) && !/\bcompletadas\b/.test(text))
    return 'pending'
  if (
    /\b(agua|litros)\b/.test(text) &&
    /\b(cuanta|cuanto|consumo|utiliz\w*|usado|gast\w*)\b/.test(text)
  )
    return 'water'
  if (
    /\bproducto\b/.test(text) &&
    /\b(cuanto|consumo|consumido|utiliz\w*|gast\w*)\b/.test(text)
  )
    return 'product'
  if (/\b(resumen|balance|completadas|cuantas tareas|como vamos)\b/.test(text))
    return 'period'
  if (/\b(informacion|datos)\b.*\b(falta\w*|incomplet\w*)\b/.test(text))
    return 'limitations'
  return resolveDemoQuestion(question)
}

const explain = (topic: DemoQuestionId, input: ExplainerInput) => {
  const answer = explainDemo(topic, input)
  if (topic === 'period' && input.completed + input.pending > 0)
    return `En los datos disponibles hay **${input.completed} tareas completadas** y **${input.pending} pendientes**.${input.unknownState ? ` Otras ${input.unknownState} tienen un estado no reconocido.` : ''}\n\n**Consumo registrado**\nSe declararon **${input.declared.waterL} L de agua** y **${input.declared.productMl} ml de producto** en ${input.declared.tasks} tareas con consumo final identificable. Las repeticiones de una comparación no se suman como tareas independientes.\n\n**Comparación con la receta**\nSobre las ${input.paired.tasks} tareas que tienen ambos datos, la receta suma ${input.paired.expectedWaterL} L de agua y ${input.paired.expectedProductMl} ml de producto; el consumo declarado suma ${input.paired.declaredWaterL} L y ${input.paired.declaredProductMl} ml. Esa diferencia no acredita por sí sola un ahorro.\n\nPuedes preguntarme **qué revisar primero**, consultar la limpieza o comparar los procedimientos. ${input.hasSimulation ? 'Esta carga incluye datos simulados, sin mediciones físicas verificadas.' : 'Los resultados describen los registros cargados y requieren revisión humana.'}`
  const scope: Record<DemoQuestionId, string> = {
    period: 'El resumen describe únicamente las tareas cargadas.',
    priorities:
      'El orden orienta la revisión de los registros; no determina una causa ni modifica tareas.',
    overdose:
      'Un registro incompleto no demuestra ausencia de sobredosis. No se propone cambiar la dosis.',
    recommended:
      'Las variantes se comparan dentro de cada tarea. Los escenarios simulados no acreditan una elección operativa.',
    discarded:
      'No elegible significa que no cumple las condiciones del cálculo con la evidencia disponible.',
    deviation:
      'Solo se comparan mediciones del mismo producto, suciedad y dosis de receta. No se atribuyen causas.',
    cleaning:
      'Una evaluación ausente no equivale a cumplimiento; una tarea con repeticiones incumplidas se cuenta una vez.',
    effluent:
      'Una decisión registrada no demuestra cumplimiento ambiental ni autoriza la disposición del efluente.',
    limitations: answer.limitations,
  }
  return `${answer.summary}\n\n**Evidencia**\n${answer.evidence}\n\n**Qué revisar**\n${answer.preliminaryRecommendation}\n\n**Alcance de la respuesta**\n${scope[topic]}${input.hasSimulation && topic !== 'limitations' ? ' Esta carga incluye datos simulados; no son mediciones físicas verificadas.' : ''}`
}

/** Respuestas locales preparadas. No recibe credenciales, usa red ni modifica registros. */
export function createPreparedDemoReply(
  question: string,
  snapshot: DemoSnapshot,
  catalog: LiveCatalog,
  previous: Topic | null = null,
): PreparedReply {
  const unsupported = (answer: string): PreparedReply => ({
    topic: null,
    answer,
    supported: false,
  })
  if (
    !question.trim() ||
    question.length > 700 ||
    /[<>]/.test(question) ||
    [...question].some(
      (char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
    ) ||
    /https?:|\b\S+@\S+\b|gsk_|ghp_|\b(api[_ -]?key|password|contrase[nñ]a|ignora|ejecuta|borra|elimina)\b/i.test(
      question,
    )
  )
    return unsupported(
      'Escribe una pregunta sobre los resultados o los conceptos de EcoCleaner, sin datos personales, claves ni instrucciones para modificar registros.',
    )
  const topic = resolveTopic(question, previous)
  if (!topic)
    return unsupported(
      'Puedo ayudarte con tareas, consumos, desvíos, limpieza, variantes, productos, efluentes y conceptos de EcoCleaner.\n\nAbre **Ver todas las preguntas** y elige uno de esos temas para continuar.',
    )
  const input = buildExplainerInput(snapshot)
  let answer: string
  if (analyses.has(topic)) answer = explain(topic as DemoQuestionId, input)
  else
    switch (topic) {
      case 'welcome':
        answer =
          '¡Hola! Soy el asistente de EcoCleaner. Puedo ayudarte a entender los resultados, revisar tareas pendientes y explicar productos, consumos y efluentes.\n\nElige una pregunta sugerida o escribe la tuya. ¿Por dónde empezamos?'
        break
      case 'about':
        answer =
          '**EcoCleaner** reúne el registro y la revisión de las actividades de limpieza: recetas, consumos, verificación de limpieza, comparación de variantes y decisiones de efluente.\n\nEste conversatorio ayuda al supervisor a interpretar los datos disponibles y conocer qué evidencia necesita revisar.'
        break
      case 'workflow':
        answer =
          'El recorrido de la aplicación es:\n\n1. El operario trabaja con la tarea y su receta de limpieza.\n2. Se registran los consumos y los resultados disponibles.\n3. El revisor verifica la limpieza y registra la decisión de efluente correspondiente.\n4. El supervisor revisa el panel, compara variantes y consulta las evidencias.\n\nPreguntar en este chat no guarda ni cambia ninguna tarea.'
        break
      case 'roles':
        answer =
          '**Operario:** consulta tareas y recetas y registra la ejecución.\n\n**Revisor:** verifica los resultados de limpieza y las decisiones de efluente.\n\n**Supervisor:** revisa los resultados, el catálogo y las comparaciones para coordinar la revisión.\n\nEl asistente acompaña la interpretación; las decisiones siguen a cargo de las personas responsables.'
        break
      case 'water':
        answer = `El consumo de agua declarado es **${input.declared.waterL} L**, en ${input.declared.tasks} tareas completadas con un consumo final identificable.\n\nLas recetas registradas suman ${input.expected.waterL} L en ${input.expected.tasks} tareas. La comparación debe hacerse sobre las mismas tareas: la base común disponible es de ${input.paired.tasks}.\n\nEstos totales no demuestran por sí solos ahorro ni una medición física; consulta la procedencia de los registros.`
        break
      case 'product':
        answer = `El consumo declarado de producto es **${input.declared.productMl} ml**, en ${input.declared.tasks} tareas completadas con un consumo final identificable.\n\nLas recetas registradas suman ${input.expected.productMl} ml en ${input.expected.tasks} tareas. Para contrastar ambos totales hay ${input.paired.tasks} tareas en común.\n\nNo se propone cambiar la dosis a partir de este resumen. Los datos simulados conservan esa condición.`
        break
      case 'pending': {
        const tasks = snapshot.tasks.filter(
          (task) => task.state === 'receta_enviada',
        )
        answer = tasks.length
          ? `Hay **${tasks.length} tareas pendientes** con receta enviada:\n\n${tasks.map((task, index) => `• ${operationalName(task.name) ?? `Tarea pendiente ${index + 1}`}${operationalName(task.areaName) ? ` · ${operationalName(task.areaName)}` : ''}`).join('\n')}\n\nRevisa su ejecución y el registro de resultados en el flujo habitual. Esta conversación no cambia su estado.`
          : 'No aparecen tareas con estado «receta enviada» en esta carga. Esto describe los registros disponibles, sin certificar que no existan tareas fuera de la carga.'
        break
      }
      case 'catalog':
        answer = catalog.products.length
          ? `El catálogo cargado contiene **${catalog.products.length} productos**:\n\n${catalog.products.map((item, index) => `• ${operationalName(item.name) ?? `Producto ${index + 1}`}${item.categories?.length ? `: ${item.categories.join(', ')}` : ''}`).join('\n')}\n\n${catalog.simulated ? 'Este catálogo es de demostración.' : 'Esta es la información del catálogo cargado.'} Consulta la ficha técnica vigente antes de cualquier uso.`
          : 'No hay productos en el catálogo cargado.'
        break
      case 'compatibility': {
        const documented = catalog.products.filter(
          (item) => item.incompatibilities?.length,
        )
        answer =
          '**No puedo confirmar que dos productos sean compatibles** por el hecho de que no aparezca un conflicto. El catálogo documenta incompatibilidades y no sustituye la ficha de seguridad.\n\n' +
          (documented.length
            ? `**Incompatibilidades registradas por producto**\n${documented.map((item, index) => `• ${operationalName(item.name) ?? `Producto ${index + 1}`}: ${item.incompatibilities!.join(', ')}.`).join('\n')}`
            : 'No hay incompatibilidades documentadas en esta carga; eso no demuestra compatibilidad.') +
          '\n\nNo mezcles productos basándote en esta respuesta. Solicita la revisión de las fichas y del procedimiento al responsable.'
        break
      }
      case 'ph':
        answer = `**pH registrado en el catálogo**\n\n${catalog.products.map((item, index) => `• ${operationalName(item.name) ?? `Producto ${index + 1}`}: ${item.ph ?? 'sin dato de pH'}.`).join('\n') || 'No hay productos cargados.'}\n\nEs información del producto; no representa el pH del efluente ni de una mezcla. ${catalog.simulated ? 'El catálogo de esta vista es simulado.' : 'Comprueba la ficha vigente del producto.'}`
        break
      case 'effluentPh':
        answer =
          'No hay mediciones de pH del efluente en el contexto de este asistente. El pH de un producto del catálogo no permite deducir el del efluente.\n\nSe necesita la medición correspondiente y la revisión del responsable. No se autoriza vertido, reutilización ni un ajuste químico con estos datos.'
        break
      case 'dilution':
        answer =
          'La **dilución** expresa cuánto producto hay en una cantidad de solución. En EcoCleaner, la receta utiliza la concentración en **ml de producto por litro de solución** junto con los datos del área y del producto.\n\nLa receta esperada y el consumo registrado se mantienen separados para poder compararlos. Este chat no calcula una nueva dosis ni cambia la ficha técnica.'
        break
      case 'deviationMeaning':
        answer =
          'El **desvío** compara la concentración registrada con la esperada en la receta. Un signo positivo indica una concentración por encima de la referencia; uno negativo, por debajo.\n\nEcoCleaner utiliza el cálculo del core cuando los datos son válidos. Un desvío no explica por sí solo la causa ni demuestra que la limpieza haya sido adecuada.'
        break
      case 'overdoseMeaning':
        answer =
          'La **sobredosis** es una alerta de exceso evaluada con la receta, el consumo y las reglas del core. También se distingue si un valor supera el máximo registrado en la ficha.\n\nConviene revisar la tarea y su evidencia antes de decidir. La ausencia de una alerta en un registro incompleto no demuestra ausencia de sobredosis.'
        break
      case 'effluentMeaning':
        answer =
          'Un **efluente** es el líquido resultante del proceso de limpieza que requiere una decisión de manejo. EcoCleaner registra decisiones como revisión o ajuste, reutilización, envío a gestor o vertido.\n\nUna decisión histórica es un registro, no una autorización emitida por el asistente. La disposición exige las verificaciones y la aprobación del responsable.'
        break
      case 'measured':
        answer =
          'Un dato **medido** está registrado como obtenido mediante una medición, con procedencia no simulada. Esa etiqueta describe el registro; el asistente no certifica el instrumento, su calibración ni la exactitud del dato.\n\nEn el escenario de demostración no hay mediciones físicas.'
        break
      case 'estimated':
        answer =
          'Un dato **estimado** representa una aproximación declarada, sin equivaler a una medición física. Debe mantenerse identificado para interpretar correctamente los resultados.\n\nSi además su procedencia es simulada, EcoCleaner lo cuenta como simulado, sin presentarlo como evidencia medida.'
        break
      case 'simulated':
        answer =
          'Un dato **simulado** se utiliza para demostrar el funcionamiento de la aplicación. No acredita que una tarea se haya ejecutado físicamente ni que se haya medido su consumo.\n\nEl escenario aislado de este asistente no guarda tareas ni modifica Supabase. Sus cálculos permiten recorrer la interfaz sin confundirlos con resultados reales.'
        break
      case 'savings':
        answer =
          'No se puede afirmar un ahorro verificado con estos datos por sí solos. Se necesita una línea base comparable, las mismas condiciones y evidencia de consumo suficiente.\n\nUna diferencia entre receta y consumo declarado, o entre variantes simuladas, no equivale a ahorro demostrado. La demo no inventa porcentajes ni costos.'
        break
      case 'review':
        answer =
          'Las respuestas reúnen registros y cálculos, pero no verifican por sí mismas las condiciones reales de ejecución, la ficha vigente o la seguridad del procedimiento.\n\nEl responsable debe revisar la evidencia antes de cambiar una dosis, elegir un procedimiento o decidir sobre un efluente.'
        break
      case 'presentation':
        answer = `**EcoCleaner en esta demostración**\n\nLa carga contiene ${snapshot.tasks.length} tareas: ${input.completed} completadas, ${input.pending} pendientes y ${input.unknownState} con estado no reconocido. El catálogo contiene ${catalog.products.length} productos.\n\nEl sistema reúne recetas, consumos, limpieza, variantes y decisiones de efluente. El supervisor puede consultar un resumen y conocer qué evidencia falta antes de tomar una decisión.\n\nLos datos simulados no son mediciones físicas y las recomendaciones requieren revisión humana.`
        break
      default:
        answer = 'Elige una de las preguntas sugeridas para continuar.'
    }
  return { topic, answer, supported: true }
}
