import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Receta } from '@ecocleaner/core'

interface OperarioFlowValue {
  recetaActiva: Receta | null
  setRecetaActiva: (receta: Receta | null) => void
}

const OperarioFlowContext = createContext<OperarioFlowValue | null>(null)

/** Estado de flujo en memoria; el id de la tarea viaja en la URL. */
export function OperarioFlowProvider({ children }: PropsWithChildren) {
  const [recetaActiva, setRecetaActiva] = useState<Receta | null>(null)
  const value = useMemo(
    () => ({ recetaActiva, setRecetaActiva }),
    [recetaActiva],
  )
  return (
    <OperarioFlowContext.Provider value={value}>
      {children}
    </OperarioFlowContext.Provider>
  )
}

export function useOperarioFlow(): OperarioFlowValue {
  const context = useContext(OperarioFlowContext)
  if (!context)
    throw new Error(
      'useOperarioFlow debe usarse dentro de OperarioFlowProvider',
    )
  return context
}

export { OPERARIO_STEPS } from './flow'
