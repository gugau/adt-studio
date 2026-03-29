import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Home } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { useWizard } from "@/components/wizard"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { PRESET_DEFAULTS } from "@/components/wizard/steps"
import { type PresetId } from "./constants"
import { PresetGrid } from "./PresetGrid"

export function Step0Preset() {
  const navigate = useNavigate()
  const { setCurrentStep } = useWizard()
  const form = useWizardForm()

  const selected = useStore(form.store, (s) => s.values.selectedPreset) as PresetId | null

  function handleSelect(id: PresetId) {
    form.setFieldValue("selectedPreset", id)
  }

  function handleContinue() {
    if (!selected) return
    const defaults = PRESET_DEFAULTS[selected] ?? {}
    for (const [key, val] of Object.entries(defaults)) {
      form.setFieldValue(key as never, val as never)
    }
    setCurrentStep(1)
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 pt-20 pb-10 relative">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="absolute left-4 sm:left-6 top-4 sm:top-6 flex items-center gap-1.5 rounded-md bg-white border border-[#e5e5e5] h-9 px-3 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
      >
        <Home className="h-4 w-4" />
        <Trans>Home</Trans>
      </button>

      <h1
        id="preset-step-heading"
        className="text-2xl sm:text-[30px] font-semibold leading-tight sm:leading-9 tracking-[-0.75px] text-[#030303] text-center"
      >
        <Trans>Choose a Preset</Trans>
      </h1>

      <PresetGrid selected={selected} onSelect={handleSelect} />

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/" })}
          className="h-9 px-3 py-2 bg-[#f5f5f5] text-[#262626] hover:bg-[#e5e5e5] border-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <Trans>Back</Trans>
        </Button>
        <Button
          disabled={!selected}
          onClick={handleContinue}
          className="h-9 px-3 py-2 bg-[#2b7fff] text-white hover:bg-[#1a6fef] border-0"
        >
          <Trans>Continue</Trans>
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
