// Punto de entrada exclusivo de servidor; no pertenece al barrel público de src/index.ts.
export { createLLMExplainer } from './explainer.ts'
export type {
  Explanation,
  ExplanationContext,
  ExplanationInput,
  ExplanationResult,
  ExplainerOptions,
  LLMProvider,
  ProviderRequest,
  ProviderResponse,
} from './contracts.ts'
