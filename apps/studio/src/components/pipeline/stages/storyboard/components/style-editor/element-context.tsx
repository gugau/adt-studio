import { createContext, useContext, type ReactNode } from "react"

interface ElementCtx {
  /** data-id of the currently-selected element */
  dataId: string
  /** Tailwind class list, in source order */
  classes: string[]
  /** Persists a new class list back to the element. */
  onClassesChange: (dataId: string, classes: string[]) => void
}

const ElementContext = createContext<ElementCtx | null>(null)

interface ElementProviderProps {
  value: ElementCtx
  children: ReactNode
}

export function ElementProvider({ value, children }: ElementProviderProps) {
  return <ElementContext.Provider value={value}>{children}</ElementContext.Provider>
}

export function useElementContext(): ElementCtx {
  const ctx = useContext(ElementContext)
  if (!ctx) {
    throw new Error("useElementContext must be used inside <ElementProvider>")
  }
  return ctx
}
