/* eslint-disable lingui/no-unlocalized-strings */
// TODO: Add translations
import { useState, type CSSProperties } from "react"
import { Trans } from "@lingui/react/macro"
import { Eye, ArrowLeft, ArrowRight, Zap } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { useBooks } from "@/hooks/use-books"
import { useWizard } from "./index"
import { useWizardForm } from "./wizardForm"
import { STEPS } from "./steps"
import { Step0Preset } from "./step0preset"
import { StudioTopBar } from "@/components/StudioTopBar"
import { PdfCoverPreview } from "./shared/PdfCoverPreview"
import { LayoutPreview, getPreviewWidth } from "./step2LayoutOptions/LayoutPreview"
import { ImageProcessingPreviewPane } from "./step3ImageProcessing/ImageProcessingPreviewPane"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

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
  const showQuickCreate = canCreate && !isLastStep

  return (
    <div
      className={cn(
        "grid w-full gap-2 px-6 py-4 border-t border-[#e5e5e5] transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        showQuickCreate ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,0fr)_minmax(0,1fr)]",
      )}
    >
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className="flex h-10 min-w-0 w-full items-center justify-center gap-1.5 px-4 font-medium"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Back
      </Button>

      <div className="min-h-10 min-w-0 overflow-hidden">
        {showQuickCreate ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCreate}
            className="flex h-10 min-w-0 w-full items-center justify-center gap-1.5 px-4 font-medium"
          >
            <Zap className="h-4 w-4 shrink-0" />
            Create Book
          </Button>
        ) : null}
      </div>

      <Button
        type="button"
        disabled={isLastStep ? !canCreate : !canContinue}
        onClick={isLastStep ? onCreate : onNext}
        className="flex h-10 min-w-0 w-full items-center justify-center gap-1.5 bg-[#2b7fff] px-4 font-medium text-white transition-opacity duration-300 ease-out hover:bg-[#1a6fef] disabled:opacity-50 border-0"
      >
        {isLastStep ? (
          <>
            <Zap className="h-4 w-4 shrink-0" />
            Create Book
          </>
        ) : (
          <>
            Next Step
            <ArrowRight className="h-4 w-4 shrink-0" />
          </>
        )}
      </Button>
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
  const { currentStep, setCurrentStep, previewFocus } = useWizard()
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

  if (currentStep === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col h-full bg-white">
        <StudioTopBar brandLinksHome trailingTitle={<Trans>Add Book</Trans>} />
        <div className="flex flex-1 min-h-0 flex-col overflow-auto">
          <Step0Preset />
        </div>
      </div>
    )
  }

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
    if (currentStep === 3)
      return <ImageProcessingPreviewPane focus={previewFocus} />
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
    <div className="flex flex-1 min-h-0 flex-col h-full bg-[#f5f5f5]">
      <StudioTopBar brandLinksHome trailingTitle={<Trans>Add Book</Trans>} />
      <div className="flex flex-1 min-h-0 lg:gap-[10px] overflow-hidden">
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
      </div>
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
