
import { useState, type CSSProperties } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Eye, ArrowLeft, ArrowRight, Zap } from "lucide-react"
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
import { ImageProcessingPreviewPane } from "./step3ContentProcessing/ImageProcessingPreviewPane"
import { LanguagesPreviewPane } from "./step4Languages/LanguagesPreviewPane"
import { StyleguidePreviewPane } from "./step5Styleguide/StyleguidePreviewPane"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function WizardHeader({ step }: { step: number }) {
  const { i18n, t } = useLingui()
  const def = STEPS[step - 1]
  return (
    <div className="flex flex-col gap-3 px-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center bg-[#fef2f2] text-[#ef4444] text-[12px] font-semibold leading-4 px-[10px] py-[4px] rounded-[4px]">
          {t`Required Fields`}
        </span>
        <span className="text-[14px] font-bold leading-5 text-[#3b82f6] uppercase tracking-wide animate-wizard-enter">
          {t`Step ${step} of ${STEPS.length}`}
        </span>
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
}: {
  isLastStep: boolean
  canContinue: boolean
  canCreate: boolean
  onBack: () => void
  onNext: () => void
  onCreate: () => void
}) {
  const { t } = useLingui()

  return (
    <div className="border-t border-[#e5e5e5] px-6 py-4 flex flex-col gap-2">
      <div className="grid grid-cols-2 w-full gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex h-10 min-w-0 w-full items-center justify-center overflow-hidden px-4 font-medium"
        >
          <span className="flex items-center gap-1.5 animate-btn-label-enter">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {t`Back`}
          </span>
        </Button>

        <TooltipProvider>
          <Tooltip open={isLastStep && !canCreate ? undefined : false}>
            <TooltipTrigger asChild>
              <span className="min-w-0 w-full">
                <Button
                  type="button"
                  disabled={isLastStep ? !canCreate : !canContinue}
                  onClick={isLastStep ? onCreate : onNext}
                  className="flex h-10 w-full items-center justify-center overflow-hidden bg-[#2b7fff] px-4 font-medium text-white transition-opacity duration-300 ease-out hover:bg-[#1a6fef] disabled:opacity-50 border-0"
                >
                  <span
                    key={isLastStep ? "create-final" : "next"}
                    className={cn(
                      "flex items-center gap-1.5",
                      isLastStep ? "animate-btn-final-enter" : "animate-btn-label-enter",
                    )}
                  >
                    {isLastStep ? (
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
      className="flex h-[812px] max-h-[80%] max-w-[80%] w-[var(--preview-w)] shrink-0 items-stretch transition-[width] duration-500"
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
  const [submitError, setSubmitError] = useState<string | null>(null)

  const values = useStore(form.store, (s) => s.values)
  const { file, renderStrategy, editingLanguage, outputLanguages, styleguide } = values
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
            <WizardHeader step={currentStep} />

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
