/* eslint-disable lingui/no-unlocalized-strings */
import { useStore } from "@tanstack/react-form"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { LanguagePicker } from "@/components/LanguagePicker"
import { normalizeLocale } from "@/lib/languages"

export function Step4() {
  const form = useWizardForm()
  const editingLanguage = useStore(form.store, (s) => s.values.editingLanguage)
  const outputLanguages = useStore(form.store, (s) => s.values.outputLanguages)

  const outputSet = new Set(outputLanguages.map(normalizeLocale))

  function toggleOutputLanguage(code: string) {
    const normalized = normalizeLocale(code)
    const next = outputSet.has(normalized)
      ? outputLanguages.filter((l) => normalizeLocale(l) !== normalized)
      : [...outputLanguages, code]
    form.setFieldValue("outputLanguages", next)
  }

  return (
    <div className="flex w-full flex-col gap-5 p-8">
      <LanguagePicker
        label="Editing Language"
        hint="Leave empty to use the book language."
        selected={editingLanguage}
        onSelect={(code) => form.setFieldValue("editingLanguage", code)}
        size="default"
      />

      <LanguagePicker
        label="Output Languages"
        hint="Leave empty to output only in the book language."
        selected={outputSet}
        onSelect={toggleOutputLanguage}
        multiple
        size="default"
      />
    </div>
  )
}
