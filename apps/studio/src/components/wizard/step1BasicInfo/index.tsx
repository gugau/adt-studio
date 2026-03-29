/* eslint-disable lingui/no-unlocalized-strings */
// TODO: Add translations
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { useBooks } from "@/hooks/use-books"
import { useWizardForm } from "../wizardForm"
import { PresetViewer } from "./PresetViewer"
import { PdfUpload } from "./PdfUpload"
import { PageRange } from "./PageRange"

export function Step1() {
  const form = useWizardForm()
  const { data: books } = useBooks()
  const existingLabels = books?.map((b: { label: string }) => b.label) ?? []

  return (
    <div className="flex flex-col gap-6 p-8">
      <PresetViewer />

      <form.Field
        name="label"
        validators={{
          onChange: z
            .string()
            .min(1, "Required")
            .regex(
              /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
              "Only letters, numbers, dots, dashes, underscores. Must start with a letter or number."
            )
            .refine((val) => !existingLabels.includes(val), "A book with this name already exists."),
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#0a0a0a]">
              Project Name <span className="text-[#ef4444]">*</span>
            </label>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="my-book"
              className={field.state.meta.errors.length > 0 ? "border-[#ef4444]" : ""}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-xs text-[#ef4444]">
                {String((field.state.meta.errors[0] as { message?: string })?.message ?? field.state.meta.errors[0])}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <PdfUpload />
      <PageRange />
    </div>
  )
}
