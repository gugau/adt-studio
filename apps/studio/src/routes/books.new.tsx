import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { WizardProvider } from "@/components/wizard"
import { WizardFormProvider } from "@/components/wizard/WizardFormProvider"
import { BookCreationWizard } from "@/components/wizard/BookCreationWizard"

const searchSchema = z.object({
  import: z.boolean().optional(),
})

function AddBookPage() {
  const { import: startImport } = Route.useSearch()
  return (
    <WizardProvider initialStep={startImport ? -1 : 0}>
      <WizardFormProvider>
        <BookCreationWizard />
      </WizardFormProvider>
    </WizardProvider>
  )
}

export const Route = createFileRoute("/books/new")({
  component: AddBookPage,
  validateSearch: searchSchema,
})
