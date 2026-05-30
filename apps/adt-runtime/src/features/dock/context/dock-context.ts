import { createContext, useContext, type RefObject } from "react"

export type DockSide = "top" | "bottom"

export interface DockContextValue {
  ref: RefObject<HTMLDivElement | null>
  popoverSide: DockSide,
  isCompact: boolean,
  isTop: boolean,
  shouldHide: boolean
  isSpread: boolean
}

export const DockContext = createContext<DockContextValue | null>(null)

export function useDockContext(): DockContextValue {
  const ctx = useContext(DockContext)
  if (!ctx) {
    throw new Error("useDockContext must be used inside <Dock>")
  }
  return ctx
}
