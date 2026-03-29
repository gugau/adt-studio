/* eslint-disable lingui/no-unlocalized-strings */
import { RotateCcw } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { useWizard } from "@/components/wizard"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { PRESETS } from "@/components/wizard/constants"

export function PresetViewer() {
  const { setCurrentStep } = useWizard()
  const form = useWizardForm()
  const selectedPreset = useStore(form.store, (s) => s.values.selectedPreset)
  const preset = PRESETS.find((p) => p.id === selectedPreset)

  if (!preset) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#0a0a0a]">Preset</label>
        <button
          type="button"
          onClick={() => setCurrentStep(0)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#2b7fff] hover:text-[#1a6fef] transition-colors cursor-pointer hover:underline"
        >
          <RotateCcw className="h-3 w-3" />
          Change Preset
        </button>
      </div>

      <div className="flex items-center gap-3 border border-[#e5e5e5] rounded-lg p-1">
        <div
          className={`flex items-center justify-center shrink-0 rounded w-[97px] h-[80px] ${preset.bgColor}`}
        >
          <preset.Icon className={`w-8 h-8 ${preset.iconColor} opacity-60`} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0 px-2 py-1">
          <p className="text-sm font-bold text-black">{preset.title}</p>
          <p className="text-xs text-[#737373] leading-5 line-clamp-2">{preset.description}</p>
        </div>
      </div>
    </div>
  )
}
