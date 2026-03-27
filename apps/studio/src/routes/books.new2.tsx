import { createFileRoute } from "@tanstack/react-router"
import { WizardProvider } from "@/components/wizard"
import { Step0Preset } from "@/components/wizard/step0preset"

function AddBookPage() {
  return (
    <WizardProvider>
      <Step0Preset />
    </WizardProvider>
  )
}

export const Route = createFileRoute("/books/new2")({
  component: AddBookPage,
})
