import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { type PresetId } from "./step0preset/constants"

// ─── Step state shapes ────────────────────────────────────────────────────────

export interface Step0State {
  selectedPreset: PresetId | null
}

// Future steps will be added here:
// export interface Step1State { ... }
// export interface Step2State { ... }

// ─── Wizard state ─────────────────────────────────────────────────────────────

export interface WizardState {
  step0: Step0State
  // step1: Step1State
  // step2: Step2State
}

const initialState: WizardState = {
  step0: {
    selectedPreset: null,
  },
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface WizardContextValue {
  state: WizardState
  setStep0: (patch: Partial<Step0State>) => void
  // setStep1: (patch: Partial<Step1State>) => void
  // setStep2: (patch: Partial<Step2State>) => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState)

  const setStep0 = useCallback((patch: Partial<Step0State>) => {
    setState((prev) => ({ ...prev, step0: { ...prev.step0, ...patch } }))
  }, [])

  return (
    <WizardContext.Provider value={{ state, setStep0 }}>
      {children}
    </WizardContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>")
  return ctx
}
