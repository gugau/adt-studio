/* eslint-disable lingui/no-unlocalized-strings */
import { useStore } from "@tanstack/react-form"
import { cn } from "@/lib/utils"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { SingleValueSlider, RangeSlider } from "@/components/wizard/shared/RangeSlider"
import { ImageProcessingFeatureSwitch } from "./ImageProcessingFeatureSwitch"
import { useWizard, useDelayedPreviewFocus } from "@/components/wizard"

function parseMinSidePx(raw: string): number {
  const n = parseInt(raw.trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const MIN_SIDE_SLIDER_MAX = 2048

function SegmentationThresholdPanel({
  segmentationMinSide,
  onMinSideChange,
  disabled,
}: {
  segmentationMinSide: string
  onMinSideChange: (v: string) => void
  disabled: boolean
}) {
  const { onMouseEnter, onMouseLeave } = useDelayedPreviewFocus("minSide")
  const px = parseMinSidePx(segmentationMinSide)

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm transition-colors",
        !disabled && "hover:bg-muted hover:border-input",
      )}
      onMouseEnter={() => {
        if (!disabled) onMouseEnter()
      }}
      onMouseLeave={onMouseLeave}
    >
      <SingleValueSlider
        label="Minimum image dimension"
        min={0}
        max={MIN_SIDE_SLIDER_MAX}
        value={px}
        onChange={(n) => onMinSideChange(n === 0 ? "" : String(n))}
        disabled={disabled}
        minValueLabel="None"
        valueUnit="px"
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Leave at None to run segmentation on all qualifying images (subject to pipeline rules).
      </p>
    </div>
  )
}

export function Step3() {
  const form = useWizardForm()
  const filterSizeHover = useDelayedPreviewFocus("filterSize")

  const imageCropping = useStore(form.store, (s) => s.values.imageCropping)
  const imageSegmentation = useStore(form.store, (s) => s.values.imageSegmentation)
  const segmentationMinSide = useStore(form.store, (s) => s.values.segmentationMinSide)
  const imageFilterMinSide = useStore(form.store, (s) => s.values.imageFilterMinSide)
  const imageFilterMaxSide = useStore(form.store, (s) => s.values.imageFilterMaxSide)

  return (
    <div className="flex w-full flex-col gap-5 p-8">
      <ImageProcessingFeatureSwitch
        id="wizard-image-cropping"
        title="Smart Cropping"
        subtitle="Best for complex content like textbooks — automatically trims stray text, artifacts, and extra margins from extracted images."
        previewFocus="cropping"
        checked={imageCropping}
        onCheckedChange={(checked) => form.setFieldValue("imageCropping", checked)}
      />

      <div className="flex w-full flex-col">
        <ImageProcessingFeatureSwitch
          id="wizard-image-segmentation"
          title="Image Segmentation"
          subtitle="Detects and splits composited illustrations into separate regions so each asset can be placed and refined on its own."
          previewFocus="segmentation"
          checked={imageSegmentation}
          onCheckedChange={(checked) => form.setFieldValue("imageSegmentation", checked)}
        />
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
            imageSegmentation ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none",
              imageSegmentation
                ? "opacity-100 translate-y-0"
                : "pointer-events-none opacity-0 -translate-y-1",
            )}
            aria-hidden={!imageSegmentation}
            inert={!imageSegmentation ? true : undefined}
          >
            <SegmentationThresholdPanel
              segmentationMinSide={segmentationMinSide}
              onMinSideChange={(v) => form.setFieldValue("segmentationMinSide", v)}
              disabled={!imageSegmentation}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border border-border bg-white px-4 py-3 shadow-sm transition-colors",
          "hover:bg-muted hover:border-input",
        )}
        onMouseEnter={filterSizeHover.onMouseEnter}
        onMouseLeave={filterSizeHover.onMouseLeave}
      >
        <RangeSlider
          label="Image Filter Size"
          min={0}
          max={10000}
          value={[imageFilterMinSide, imageFilterMaxSide]}
          onChange={([lo, hi]) => {
            form.setFieldValue("imageFilterMinSide", lo)
            form.setFieldValue("imageFilterMaxSide", hi)
          }}
          startLabel="Min Side"
          endLabel="Max Side"
        />
      </div>
    </div>
  )
}
