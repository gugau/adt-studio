import { createContext, useContext, type ReactNode } from "react"
import type { DeviceView } from "./device-breakpoint"

interface ElementCtx {
  /** data-id of the currently-selected element */
  dataId: string
  /** Tailwind class list, in source order */
  classes: string[]
  /** Persists a new class list back to the element. */
  onClassesChange: (dataId: string, classes: string[]) => void
  deviceView: DeviceView
  /** Snapshot of the iframe element's getComputedStyle, used as a fallback so
   *  the inspector can show what the element actually renders at when no
   *  explicit class is set (e.g., font-size inherited from a parent). */
  computedStyles?: {
    fontSize?: number | null
    color?: string | null
    fontWeight?: string | null
    lineHeight?: number | null
    textAlign?: string | null
    /** Primary declared font family of the element's text (e.g. "Mouse
     *  Memoirs"), read from the rendered HTML. Display-only. */
    fontFamily?: string | null
  }
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
