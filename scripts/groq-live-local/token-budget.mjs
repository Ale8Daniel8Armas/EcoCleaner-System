import { Tiktoken } from 'js-tiktoken/lite'
import ranks from 'js-tiktoken/ranks/o200k_base'

// Harmony comparte las reglas BPE base. Se estima todo el cuerpo y se añade margen;
// no se afirma un conteo exacto del encuadre privado del proveedor.
const encoder = new Tiktoken(ranks)
export const estimateTokens = (body) =>
  encoder.encode(body, [], []).length + 512
