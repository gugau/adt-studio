import { createFileRoute } from "@tanstack/react-router"
import { WizardProvider } from "@/components/wizard"
import { WizardFormProvider } from "@/components/wizard/WizardFormProvider"
import { BookCreationWizard } from "@/components/wizard/BookCreationWizard"

function AddBookPage() {
  return (
    <WizardProvider>
      <WizardFormProvider>
        <BookCreationWizard />
      </WizardFormProvider>
    </WizardProvider>
  )
}

export const Route = createFileRoute("/books/new2")({
  component: AddBookPage,
})
