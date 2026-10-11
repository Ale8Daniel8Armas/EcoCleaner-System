/** Error de dominio recuperable por cualquier interfaz, sin dependencias de UI. */
export class ErrorValidacionCore extends Error {
  readonly codigo = 'DATOS_INVALIDOS'
  readonly campo: string

  constructor(campo: string, mensaje: string) {
    super(`${campo}: ${mensaje}`)
    this.name = 'ErrorValidacionCore'
    this.campo = campo
  }
}

export function exigir(condicion: boolean, campo: string, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorValidacionCore(campo, mensaje)
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function esFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** Elimina ruido binario con 15 cifras significativas, sin redondear cantidades pequeñas a cero. */
export function precisar(valor: number): number {
  const redondeado = Number(valor.toPrecision(15))
  // En el extremo de Number.MAX_VALUE, el redondeo puede desbordar aunque la entrada sea finita.
  return Number.isFinite(redondeado) ? redondeado : valor
}
