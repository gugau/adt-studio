/* eslint-disable lingui/no-unlocalized-strings */
// TODO: Add translations
import { useState, useEffect, useRef, type CSSProperties } from "react"
import { Trans } from "@lingui/react/macro"
import { Eye, ArrowLeft, ArrowRight, Zap, SlidersHorizontal } from "lucide-react"
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
import { LanguagesPreviewPane } from "./step4Languages/LanguagesPreviewPane"
import { StyleguidePreviewPane } from "./step5Styleguide/StyleguidePreviewPane"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function WizardHeader({ step, hideStepCount = false }: { step: number; hideStepCount?: boolean }) {
  const def = STEPS[step - 1]
  return (
    <div className="flex flex-col gap-3 px-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center bg-[#fef2f2] text-[#ef4444] text-[12px] font-semibold leading-4 px-[10px] py-[4px] rounded-[4px]">
          Required Fields
        </span>
        {!hideStepCount && (
          <span className="text-[14px] font-bold leading-5 text-[#3b82f6] uppercase tracking-wide animate-wizard-enter">
            Step {step} of {STEPS.length}
          </span>
        )}
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
  quickMode = false,
  onConfigure,
}: {
  isLastStep: boolean
  canContinue: boolean
  canCreate: boolean
  onBack: () => void
  onNext: () => void
  onCreate: () => void
  quickMode?: boolean
  onConfigure?: () => void
}) {
  return (
    <div className="border-t border-[#e5e5e5] px-6 py-4 flex flex-col gap-2">
      {quickMode && (
        <p className="text-center text-xs text-[#a3a3a3] animate-btn-label-enter">
          Your preset is ready — create now or walk through each step
        </p>
      )}
      <div className="grid grid-cols-2 w-full gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={quickMode ? onConfigure : onBack}
          className="flex h-10 min-w-0 w-full items-center justify-center overflow-hidden px-4 font-medium"
        >
          <span key={quickMode ? "step-by-step" : "back"} className="flex items-center gap-1.5 animate-btn-label-enter">
            {quickMode ? (
              <>
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                Step by Step
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Back
              </>
            )}
          </span>
        </Button>

        <Button
          type="button"
          disabled={(isLastStep || quickMode) ? !canCreate : !canContinue}
          onClick={isLastStep || quickMode ? onCreate : onNext}
          className="flex h-10 min-w-0 w-full items-center justify-center overflow-hidden bg-[#2b7fff] px-4 font-medium text-white transition-opacity duration-300 ease-out hover:bg-[#1a6fef] disabled:opacity-50 border-0"
        >
          <span
            key={isLastStep ? "create-final" : quickMode ? "create-quick" : "next"}
            className={cn(
              "flex items-center gap-1.5",
              isLastStep ? "animate-btn-final-enter" : "animate-btn-label-enter",
            )}
          >
            {isLastStep || quickMode ? (
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
          </span>
        </Button>
      </div>
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
        className="mx-auto w-[var(--preview-w)] max-w-full shrink-0 [aspect-ratio:var(--preview-ar)] transition-[width] duration-500"
        style={previewShellVars(width)}
      >
        {children}
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
  const [isDetailed, setIsDetailed] = useState(false)
  const prevStepRef = useRef(currentStep)
  const [cameBackToPreset, setCameBackToPreset] = useState(false)

  useEffect(() => {
    if (currentStep === 0 && prevStepRef.current > 0) {
      setCameBackToPreset(true)
    }
    prevStepRef.current = currentStep
  }, [currentStep])

  const values = useStore(form.store, (s) => s.values)
  const selectedPreset = useStore(form.store, (s) => s.values.selectedPreset)
  const file = useStore(form.store, (s) => s.values.file)
  const renderStrategy = useStore(form.store, (s) => s.values.renderStrategy)
  const editingLanguage = useStore(form.store, (s) => s.values.editingLanguage)
  const outputLanguages = useStore(form.store, (s) => s.values.outputLanguages)
  const styleguide = useStore(form.store, (s) => s.values.styleguide)
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
          <Step0Preset showWarning={cameBackToPreset} onPresetChanged={() => setIsDetailed(false)} />
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

  function renderPreviewContent({mobileMode}: {mobileMode: boolean} = {mobileMode: false}) {
    if (currentStep === 1) return <PdfCoverPreview file={file} width={650} height={812} />
    if (currentStep === 2) return <LayoutPreview strategy={renderStrategy} />
    if (currentStep === 3)
      return <ImageProcessingPreviewPane focus={previewFocus} mobile={mobileMode} />
    if (currentStep === 4)
      return <LanguagesPreviewPane editingLanguage={editingLanguage} outputLanguages={outputLanguages} />
    if (currentStep === 5)
      return <StyleguidePreviewPane styleguide={styleguide} />
    return <span className="text-sm text-[#a3a3a3]">Book preview</span>
  }

  const previewDesktop = (
    <PreviewContainer width={previewWidth} variant="desktop">
      {renderPreviewContent()}
    </PreviewContainer>
  )

  const previewDialog = (
    <PreviewContainer width={previewWidth} variant="dialog">
      {renderPreviewContent({mobileMode: true})}
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
            <WizardHeader step={currentStep} hideStepCount={currentStep === 1 && !isDetailed && selectedPreset !== "custom"} />

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
            quickMode={currentStep === 1 && !isDetailed && selectedPreset !== "custom"}
            onConfigure={() => setIsDetailed(true)}
          />
        </aside>

        <main className="hidden flex-1 items-center justify-center overflow-auto lg:flex">
          {previewDesktop}
        </main>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[96dvh] w-full max-w-[min(97vw,calc(100vw-0.5rem))] flex-col overflow-hidden border-0 bg-[#f5f5f5] p-3 sm:p-5 rounded-lg">
          <DialogTitle className="sr-only">Book Preview</DialogTitle>
          <DialogDescription className="sr-only">
            This is a preview of the options you have selected for your book, each option affects
            the preview in a different way.
          </DialogDescription>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto h-full">
            {previewDialog}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
