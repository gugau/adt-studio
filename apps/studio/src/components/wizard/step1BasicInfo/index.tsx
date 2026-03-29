import { useBooks } from "@/hooks/use-books"
import { useWizardForm } from "../wizardForm"
import { PresetViewer } from "./PresetViewer"
import { PdfUpload } from "./PdfUpload"
import { PageRange } from "./PageRange"
import { ProjectNameField } from "./ProjectNameField"
import { createProjectLabelSchema } from "./projectLabelSchema"

export function Step1() {
  const form = useWizardForm()
  const { data: books } = useBooks()
  const existingLabels = books?.map((b: { label: string }) => b.label) ?? []

  return (
    <div className="flex flex-col gap-6 p-8">
      <PresetViewer />
      <PdfUpload />

      <form.Field
        name="label"
        validators={{
          onChange: createProjectLabelSchema(existingLabels),
        }}
      >
        {(field) => (
          <ProjectNameField
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            errors={field.state.meta.errors}
          />
        )}
      </form.Field>

      <PageRange />
    </div>
  )
}
