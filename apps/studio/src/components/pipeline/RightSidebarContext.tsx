import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export interface RightSidebarState {
  /** Replaces the "header" content that used to live in StepViewRouter */
  header: ReactNode | null
}

export interface RightSidebarControls {
  setHeader: (node: ReactNode | null) => void
}

const RightSidebarStateContext = createContext<RightSidebarState | null>(null)
const RightSidebarControlsContext = createContext<RightSidebarControls | null>(null)

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ReactNode | null>(null)

  const state = useMemo(() => ({ header }), [header])
  const controls = useMemo(() => ({ setHeader }), [])

  return (
    <RightSidebarControlsContext.Provider value={controls}>
      <RightSidebarStateContext.Provider value={state}>
        {children}
      </RightSidebarStateContext.Provider>
    </RightSidebarControlsContext.Provider>
  )
}

export function useRightSidebarState(): RightSidebarState {
  const v = useContext(RightSidebarStateContext)
  if (!v) throw new Error("useRightSidebarState must be used within RightSidebarProvider")
  return v
}

export function useRightSidebarControls(): RightSidebarControls {
  const v = useContext(RightSidebarControlsContext)
  if (!v) throw new Error("useRightSidebarControls must be used within RightSidebarProvider")
  return v
}
