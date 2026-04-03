import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type { ImageProcessingPreviewFocus } from "./step3ContentProcessing/imageProcessingPreviewTypes"

interface WizardContextValue {
  currentStep: number
  setCurrentStep: (step: number) => void
  previewFocus: ImageProcessingPreviewFocus
  setPreviewFocus: (focus: ImageProcessingPreviewFocus) => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStepRaw] = useState(0)

  useEffect(() => {
    if (currentStep === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [currentStep])

  const [previewFocus, setPreviewFocusRaw] =
    useState<ImageProcessingPreviewFocus>("idle")

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepRaw(step)
    if (step !== 3) setPreviewFocusRaw("idle")
  }, [])

  const setPreviewFocus = useCallback(
    (focus: ImageProcessingPreviewFocus) => setPreviewFocusRaw(focus),
    [],
  )

  return (
    <WizardContext.Provider
      value={{ currentStep, setCurrentStep, previewFocus, setPreviewFocus }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>")
  return ctx
}

const PREVIEW_HOVER_DELAY = 300

export function useDelayedPreviewFocus(focus: ImageProcessingPreviewFocus) {
  const { setPreviewFocus } = useWizard()
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setPreviewFocus(focus), PREVIEW_HOVER_DELAY)
  }, [focus, setPreviewFocus])

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return { onMouseEnter, onMouseLeave }
}
