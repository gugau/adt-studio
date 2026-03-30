/* eslint-disable lingui/no-unlocalized-strings */
// TODO: Add translations
import { useState, type CSSProperties } from "react"
import { Eye, ArrowLeft, ArrowRight, Zap } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { useBooks } from "@/hooks/use-books"
import { useWizard } from "./index"
import { useWizardForm } from "./wizardForm"
import { STEPS } from "./steps"
import { Step0Preset } from "./step0preset"
import { PdfCoverPreview } from "./shared/PdfCoverPreview"
import { LayoutPreview, getPreviewWidth } from "./step2LayoutOptions/LayoutPreview"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

function WizardHeader({ step }: { step: number }) {
  const def = STEPS[step - 1]
  return (
    <div className="flex flex-col gap-3 px-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center bg-[#fef2f2] text-[#ef4444] text-[12px] font-semibold leading-4 px-[10px] py-[4px] rounded-[4px]">
          Required Fields
        </span>
        <span className="text-[14px] font-bold leading-5 text-[#3b82f6] uppercase tracking-wide">
          Step {step} of {STEPS.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.75px] text-black">
          {def.title}
        </h1>
        <p className="text-[14px] font-medium text-[#737373]">{def.description}</p>
      </div>
    </div>
  )
}
// TODO: The next step buttons became the creation button on the last step and the "create book right away" should only be visible on the earlier steps, the idea is for it to be a quick way for the user to create the book directly, when a preset was selected.
function WizardFooter({
  isLastStep,
  canContinue,
  canCreate,
  onBack,
  onNext,
  onCreate,
}: {
  isLastStep: boolean
  canContinue: boolean
  canCreate: boolean
  onBack: () => void
  onNext: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-6 py-4 border-t border-[#e5e5e5]">
      <Button type="button" variant="outline" onClick={onBack} className="flex items-center gap-1.5 h-10 px-4 font-medium">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Button
        type="button"
        variant="ghost"
        disabled={!canCreate}
        onClick={onCreate}
        className="flex items-center gap-1.5 h-10 px-4 font-medium text-[#737373] disabled:opacity-40"
      >
        <Zap className="h-4 w-4" />
        Create Book right away
      </Button>

      {!isLastStep && (
        <Button
          type="button"
          disabled={!canContinue}
          onClick={onNext}
          className="ml-auto flex items-center gap-1.5 h-10 px-4 bg-[#2b7fff] text-white hover:bg-[#1a6fef] border-0 font-medium disabled:opacity-50"
        >
          Next Step
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function previewShellVars(width: number): CSSProperties {
  return {
    "--preview-w": `${width}px`,
    "--preview-ar": `${width} / 812`,
  } as CSSProperties
}

function PreviewContainer({
  children,
  width = 650,
  variant = "desktop",
}: {
  children: React.ReactNode
  width?: number
  variant?: "desktop" | "dialog"
}) {
  if (variant === "dialog") {
    return (
      <div
        className="mx-auto h-auto max-h-[min(812px,calc(100dvh-9rem))] w-[var(--preview-w)] max-w-full shrink-0 overflow-hidden [aspect-ratio:var(--preview-ar)] transition-[width] duration-500"
        style={previewShellVars(width)}
      >
        <div className="flex h-full min-h-0 w-full flex-col">{children}</div>
      </div>
    )
  }

  return (
    <div
      className="flex h-[812px] max-h-[80%] max-w-[80%] w-[var(--preview-w)] shrink-0 items-center justify-center transition-[width] duration-500"
      style={{ "--preview-w": `${width}px` } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function BookCreationWizard() {
  const { currentStep, setCurrentStep } = useWizard()
  const form = useWizardForm()
  const { data: books } = useBooks()
  const [previewOpen, setPreviewOpen] = useState(false)

  const values = useStore(form.store, (s) => s.values)
  const file = useStore(form.store, (s) => s.values.file)
  const renderStrategy = useStore(form.store, (s) => s.values.renderStrategy)
  const stepIndex = currentStep - 1
  const existingBookLabels = books?.map((b: { label: string }) => b.label) ?? []
  const stepValidationContext = { existingBookLabels }
  const canContinue =
    currentStep >= 1
      ? STEPS[stepIndex].isValid(values, stepValidationContext)
      : false
  const canCreate = STEPS.every((s) => s.isValid(values, stepValidationContext))

  if (currentStep === 0) return <Step0Preset />

  const StepComponent = STEPS[stepIndex].component

  function handleBack() {
    setCurrentStep(currentStep <= 1 ? 0 : currentStep - 1)
  }

  function handleNext() {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1)
  }

  function handleCreate() {
    console.log("Wizard form values:", form.state.values)
  }
  const previewWidth = currentStep === 2 ? getPreviewWidth(renderStrategy) : 650

  function renderPreviewContent() {
    if (currentStep === 1) return <PdfCoverPreview file={file} width={650} height={812} />
    if (currentStep === 2) return <LayoutPreview strategy={renderStrategy} />
    return <span className="text-sm text-[#a3a3a3]">Book preview</span>
  }

  const previewDesktop = (
    <PreviewContainer width={previewWidth} variant="desktop">
      {renderPreviewContent()}
    </PreviewContainer>
  )

  const previewDialog = (
    <PreviewContainer width={previewWidth} variant="dialog">
      {renderPreviewContent()}
    </PreviewContainer>
  )

  return (
    <div className="h-screen bg-[#f5f5f5] flex lg:gap-[10px]">
      <aside className="bg-white flex flex-col w-full lg:w-[633px] lg:shrink-0 overflow-hidden">
        <div className="flex items-center justify-end px-4 py-2.5 border-b border-[#e5e5e5] lg:hidden">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#2b7fff]"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>

        <div className="mx-auto flex w-full min-h-0 lg:pr-8 flex-1 flex-col overflow-hidden">
          <WizardHeader step={currentStep} />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <StepComponent />
          </div>
        </div>

        <WizardFooter
          isLastStep={currentStep === STEPS.length}
          canContinue={canContinue}
          canCreate={canCreate}
          onBack={handleBack}
          onNext={handleNext}
          onCreate={handleCreate}
        />
      </aside>

      <main className="hidden flex-1 items-center justify-center overflow-auto lg:flex">
        {previewDesktop}
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[92dvh] w-full max-w-[min(95vw,calc(100vw-1rem))] flex-col overflow-hidden border-0 bg-[#f5f5f5] p-4 sm:p-6 rounded-lg">
          <DialogTitle className="sr-only">Book Preview</DialogTitle>
          <DialogDescription className="sr-only">
            This is a preview of the options you have selected for your book, each option affects
            the preview in a different way.
          </DialogDescription>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
            {previewDialog}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
