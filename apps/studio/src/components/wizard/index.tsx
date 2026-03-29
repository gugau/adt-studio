import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"

// Navigation state only — form field data lives in WizardFormProvider.

interface WizardContextValue {
  currentStep: number
  setCurrentStep: (step: number) => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStepRaw] = useState(0)

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepRaw(step)
  }, [])

  return (
    <WizardContext.Provider value={{ currentStep, setCurrentStep }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>")
  return ctx
}
