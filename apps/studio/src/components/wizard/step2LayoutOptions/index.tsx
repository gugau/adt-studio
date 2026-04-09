import { useStore } from "@tanstack/react-form"
import { RenderStrategyPicker } from "./RenderStrategyPicker"
import { PageGroupingMode } from "./PageGroupingMode"
import { SectioningMode } from "./SectioningMode"
import { useWizardForm } from "@/components/wizard/wizardForm"

export function Step2() {
  const form = useWizardForm()
  const selectedPreset = useStore(form.store, (s) => s.values.selectedPreset)
  const isFixedLayout = selectedPreset === "fixed"

  return (
    <div className="flex flex-col gap-6 p-8">
      {!isFixedLayout && <RenderStrategyPicker />}
      <PageGroupingMode />
      {!isFixedLayout && <SectioningMode />}
    </div>
  )
}
