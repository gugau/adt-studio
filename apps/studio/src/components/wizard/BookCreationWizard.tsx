
import { useState, useEffect, useRef, type CSSProperties } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Eye, ArrowLeft, ArrowRight, Zap, SlidersHorizontal } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { api } from "@/api/client"
import { useApiKey } from "@/hooks/use-api-key"
import { useBooks, useCreateBook } from "@/hooks/use-books"
import { useWizard } from "./index"
import { useWizardForm } from "./wizardForm"
import { STEPS } from "./steps"
import { buildConfigOverrides } from "./bookCreationConfig"
import { Step0Preset } from "./step0preset"
import { StudioTopBar } from "@/components/StudioTopBar"
import { PdfCoverPreview } from "./shared/PdfCoverPreview"
import { LayoutPreview, getPreviewWidth } from "./step2LayoutOptions/LayoutPreview"
import { ImageProcessingPreviewPane } from "./step3ImageProcessing/ImageProcessingPreviewPane"
import { LanguagesPreviewPane } from "./step4Languages/LanguagesPreviewPane"
import { StyleguidePreviewPane } from "./step5Styleguide/StyleguidePreviewPane"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function WizardHeader({ step, hideStepCount = false }: { step: number; hideStepCount?: boolean }) {
  const { i18n, t } = useLingui()
  const def = STEPS[step - 1]
  return (
    <div className="flex flex-col gap-3 px-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center bg-[#fef2f2] text-[#ef4444] text-[12px] font-semibold leading-4 px-[10px] py-[4px] rounded-[4px]">
          {t`Required Fields`}
        </span>
        {!hideStepCount && (
          <span className="text-[14px] font-bold leading-5 text-[#3b82f6] uppercase tracking-wide animate-wizard-enter">
            {t`Step ${step} of ${STEPS.length}`}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.75px] text-black">
          {i18n._(def.title)}
        </h1>
        <p className="text-[14px] font-medium text-[#737373]">{i18n._(def.description)}</p>
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
  const { i18n, t } = useLingui()

  return (
    <div className="border-t border-[#e5e5e5] px-6 py-4 flex flex-col gap-2">
      {quickMode && (
        <p className="text-center text-xs text-[#a3a3a3] animate-btn-label-enter">
          {t`Your preset is ready - create now or walk through each step`}
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
                {t`Step by Step`}
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 shrink-0" />
                {t`Back`}
              </>
            )}
          </span>
        </Button>

        <TooltipProvider>
          <Tooltip open={quickMode && !canContinue ? undefined : false}>
            <TooltipTrigger asChild>
              <span className="min-w-0 w-full">
                <Button
                  type="button"
                  disabled={(isLastStep || quickMode) ? !canCreate : !canContinue}
                  onClick={isLastStep || quickMode ? onCreate : onNext}
                  className="flex h-10 w-full items-center justify-center overflow-hidden bg-[#2b7fff] px-4 font-medium text-white transition-opacity duration-300 ease-out hover:bg-[#1a6fef] disabled:opacity-50 border-0"
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
                        {t`Create Book`}
                      </>
                    ) : (
                      <>
                        {t`Next Step`}
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </>
                    )}
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t`Upload a PDF and fill the Project name with a valid label first`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
  const { t } = useLingui()
  const navigate = useNavigate()
  const { currentStep, setCurrentStep, previewFocus } = useWizard()
  const form = useWizardForm()
  const createMutation = useCreateBook()
  const { data: books } = useBooks()
  const { apiKey, hasApiKey, azureKey, azureRegion, geminiKey } = useApiKey()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isDetailed, setIsDetailed] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const prevStepRef = useRef(currentStep)
  const [cameBackToPreset, setCameBackToPreset] = useState(false)

  useEffect(() => {
    if (currentStep === 0 && prevStepRef.current > 0) {
      setCameBackToPreset(true)
    }
    prevStepRef.current = currentStep
  }, [currentStep])

  const values = useStore(form.store, (s) => s.values)
  const { selectedPreset, file, renderStrategy, editingLanguage, outputLanguages, styleguide } = values
  const stepIndex = currentStep - 1
  const existingBookLabels = books?.map((b: { label: string }) => b.label) ?? []
  const stepValidationContext = { existingBookLabels }
  const canContinue =
    currentStep >= 1
      ? STEPS[stepIndex].isValid(values, stepValidationContext)
      : false
  const canCreate = STEPS.every((s) => s.isValid(values, stepValidationContext))
  const isQuickMode = currentStep === 1 && !isDetailed && selectedPreset !== "custom"

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

  async function handleCreate() {
    setSubmitError(null)
    try {
      const book = await createMutation.mutateAsync({
        label: values.label.trim(),
        pdf: values.file!,
        config: buildConfigOverrides(values),
      })

      if (hasApiKey && apiKey) {
        try {
          await api.runStages(
            book.label,
            apiKey,
            { fromStage: "extract", toStage: "storyboard" },
            { azure: { key: azureKey, region: azureRegion }, geminiApiKey: geminiKey },
          )
        } catch {}
      }

      navigate({ to: "/books/$label/$step", params: { label: book.label, step: "book" } })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t`Failed to create book.`)
    }
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
    return <span className="text-sm text-[#a3a3a3]">{t`Book preview`}</span>
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
              {t`Preview`}
            </button>
          </div>

          <div className="mx-auto flex w-full min-h-0 lg:pr-8 flex-1 flex-col overflow-hidden">
            <WizardHeader step={currentStep} hideStepCount={isQuickMode} />

            <div className="min-h-0 flex-1 overflow-y-auto">
              <StepComponent />
            </div>
          </div>


          {(submitError || createMutation.isError) && (
            <p className="px-6 pb-3 text-sm text-center text-[#ef4444] animate-btn-label-enter">
              {submitError ?? createMutation.error?.message ?? t`Failed to create book.`}
            </p>
          )}
          <WizardFooter
            isLastStep={currentStep === STEPS.length}
            canContinue={canContinue}
            canCreate={canCreate && !createMutation.isPending}
            onBack={handleBack}
            onNext={handleNext}
            onCreate={handleCreate}
            quickMode={isQuickMode}
            onConfigure={() => setIsDetailed(true)}
          />
        </aside>

        <main className="hidden flex-1 items-center justify-center overflow-auto lg:flex">
          {previewDesktop}
        </main>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[96dvh] w-full max-w-[min(97vw,calc(100vw-0.5rem))] flex-col overflow-hidden border-0 bg-[#f5f5f5] p-3 sm:p-5 rounded-lg">
          <DialogTitle className="sr-only">{t`Book Preview`}</DialogTitle>
          <DialogDescription className="sr-only">
            {t`This is a preview of the options you have selected for your book, each option affects the preview in a different way.`}
          </DialogDescription>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto h-full">
            {previewDialog}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
