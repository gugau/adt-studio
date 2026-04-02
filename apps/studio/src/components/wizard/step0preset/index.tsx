import { useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { useWizard } from "@/components/wizard"
import { useWizardForm, defaultWizardValues } from "@/components/wizard/wizardForm"
import { PRESET_DEFAULTS, type PresetId } from "@/components/wizard/constants"
import { PresetGrid } from "./PresetGrid"

/* eslint-disable-next-line lingui/no-unlocalized-strings */
const PRESERVED_FIELDS = ["label", "file", "startPage", "endPage"] as const

export function Step0Preset({
  showWarning = false,
  onPresetChanged,
}: {
  showWarning?: boolean
  onPresetChanged?: () => void
}) {
  const navigate = useNavigate()
  const { setCurrentStep } = useWizard()
  const form = useWizardForm()



  const selected = useStore(form.store, (s) => s.values.selectedPreset) as PresetId | null
  const initialPreset = useRef(selected)
  const presetChanged = showWarning && selected !== initialPreset.current

  function applyPreset(id: PresetId) {
    const preserved: Partial<Record<(typeof PRESERVED_FIELDS)[number], unknown>> = {}
    for (const field of PRESERVED_FIELDS) {
      preserved[field] = form.getFieldValue(field)
    }

    for (const [key, val] of Object.entries(defaultWizardValues)) {
      if (!PRESERVED_FIELDS.includes(key as never)) {
        form.setFieldValue(key as never, val as never)
      }
    }

    for (const [key, val] of Object.entries(PRESET_DEFAULTS[id])) {
      form.setFieldValue(key as never, val as never)
    }

    for (const [key, val] of Object.entries(preserved)) {
      form.setFieldValue(key as never, val as never)
    }

    form.setFieldValue("selectedPreset", id)
  }

  function handleSelect(id: PresetId) {
    form.setFieldValue("selectedPreset", id)
  }

  function handleContinue() {
    if (!selected) return
    if (!showWarning || presetChanged) {
      applyPreset(selected)
      if (presetChanged) onPresetChanged?.()
    }
    setCurrentStep(1)
  }

  return (
    <div className="flex flex-1 min-h-0 w-full bg-white flex-col items-center justify-center gap-6 sm:gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-1">
        <h1
          id="preset-step-heading"
          className="text-2xl sm:text-[30px] font-semibold leading-tight sm:leading-9 tracking-[-0.75px] text-[#030303] text-center"
        >
          <Trans>Choose a Preset</Trans>
        </h1>
        <p className={`text-sm font-medium text-[#ef4444] text-center transition-opacity duration-200 ${presetChanged ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <Trans>Changing the preset will reset your current configuration.</Trans>
        </p>
      </div>

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
