import { buildExplainerInput } from './buildExplainerInput'
import type { DemoExplanation, DemoSnapshot, ExplainerInput } from './contracts'
import { explainDemo } from './explainDemo'
import type { DemoQuestionId } from './explainDemo'

export const DEMO_ERROR =
  'No se pudo preparar la explicación. El panel supervisor continúa disponible; revisa los registros desde sus vistas habituales.'

export function prepareDemoView(
  snapshot: DemoSnapshot,
  question: DemoQuestionId,
):
  | { input: ExplainerInput; answer: DemoExplanation; error: false }
  | { error: true } {
  try {
    const input = buildExplainerInput(snapshot)
    return { input, answer: explainDemo(question, input), error: false }
  } catch {
    return { error: true }
  }
}
