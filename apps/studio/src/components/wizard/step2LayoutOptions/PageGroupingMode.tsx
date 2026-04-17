import { useMemo } from "react"
import { useStore } from "@tanstack/react-form"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { Label } from "@/components/ui/label"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { usePresetRecommendations } from "@/components/wizard/usePresetRecommendations"
import { PRESETS, getPresetAccent } from "@/components/wizard/constants"
import { InfoCarousel, type CarouselSlide } from "@/components/wizard/shared/InfoCarousel"

const GROUPING_OPTION_SPREAD_LABEL = msg`Spread`
const GROUPING_OPTION_SINGLE_LABEL = msg`Single`

const INFO_CAROUSEL_LABEL = msg`About page grouping`

const CAROUSEL_SPREAD_TITLE = msg`Spread Mode`
const CAROUSEL_SPREAD_DESCRIPTION = msg`Many printed books are designed with facing pages in mind - illustrations that span two pages, or text that flows across a spread. Spread mode merges each pair of facing pages so content isn't split apart. The cover stays standalone, then pages are paired: 2+3, 4+5, etc.`

const CAROUSEL_SINGLE_TITLE = msg`Single Mode`
const CAROUSEL_SINGLE_DESCRIPTION = msg`When your PDF isn't built around facing pages, single mode keeps every page separate: nothing is merged across a spread. That matches how most textbooks, novels, and reference books are read - one page at a time.`

function SpreadDiagram() {
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      <div className="flex h-[72px] w-10 items-center justify-center rounded border border-border bg-background text-[8px] text-muted-foreground">
        <Trans>Cover</Trans>
      </div>
      {/* eslint-disable lingui/no-unlocalized-strings */}
      <div className="flex h-[72px] w-[72px] rounded border border-primary/30 bg-primary/5">
        <div className="flex h-full w-full">
          <div className="flex flex-1 items-center justify-center border-r border-dashed border-primary/20 text-[8px] text-primary">
            P2
          </div>
          <div className="flex flex-1 items-center justify-center text-[8px] text-primary">
            P3
          </div>
        </div>
      </div>
      <div className="flex h-[72px] w-[72px] rounded border border-primary/30 bg-primary/5">
        <div className="flex h-full w-full">
          <div className="flex flex-1 items-center justify-center border-r border-dashed border-primary/20 text-[8px] text-primary">
            P4
          </div>
          <div className="flex flex-1 items-center justify-center text-[8px] text-primary">
            P5
          </div>
        </div>
      </div>
    </div>
  )
  {/* eslint-enable lingui/no-unlocalized-strings */}
}

/* eslint-disable-next-line lingui/no-unlocalized-strings */
const SINGLE_DIAGRAM_PAGE_LABELS = ["P1", "P2", "P3", "P4", "P5"] as const

function SingleDiagram() {
  const { i18n } = useLingui()

  return (
    <div className="flex items-end justify-center gap-2 py-2">
      {SINGLE_DIAGRAM_PAGE_LABELS.map((labelMsg, idx) => (
        <div
          key={idx}
          className="flex h-[72px] w-10 items-center justify-center rounded border border-border bg-background text-[8px] text-muted-foreground"
        >
          {i18n._(labelMsg)}
        </div>
      ))}
    </div>
  )
}

export function PageGroupingMode() {
  const form = useWizardForm()
  const pageGrouping = useStore(form.store, (s) => s.values.pageGrouping)
  const selectedPresetId = useStore(form.store, (s) => s.values.selectedPreset)
  const { i18n } = useLingui()
  const recommendations = usePresetRecommendations()
  const recommended = recommendations.pageGrouping || undefined

  const preset = PRESETS.find((p) => p.id === selectedPresetId)
  const accent = getPresetAccent(selectedPresetId)

  const groupingOptions = useMemo(
    () => [
      { value: "spread" as const, label: i18n._(GROUPING_OPTION_SPREAD_LABEL) },
      { value: "single" as const, label: i18n._(GROUPING_OPTION_SINGLE_LABEL) },
    ],
    [i18n.locale],
  )

  const recommendedOption = recommended
    ? groupingOptions.find((o) => o.value === recommended)
    : null

  const slides = useMemo(
    (): CarouselSlide[] => [
      {
        title: i18n._(CAROUSEL_SPREAD_TITLE),
        description: i18n._(CAROUSEL_SPREAD_DESCRIPTION),
        Diagram: SpreadDiagram,
      },
      {
        title: i18n._(CAROUSEL_SINGLE_TITLE),
        description: i18n._(CAROUSEL_SINGLE_DESCRIPTION),
        Diagram: SingleDiagram,
      },
    ],
    [i18n.locale],
  )

  return (
    <div id="wizard-page-grouping" className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-1">
        <Label className="text-sm font-medium text-foreground">
          <Trans>Page Grouping Mode</Trans>
        </Label>
        <span className="text-sm font-medium text-destructive" aria-hidden>
          *
        </span>
        <InfoCarousel label={i18n._(INFO_CAROUSEL_LABEL)} slides={slides} />
      </div>
      <SegmentedControl
        options={groupingOptions}
        value={pageGrouping}
        onValueChange={(v) => form.setFieldValue("pageGrouping", v)}
        color={accent.bg}
      />
      {recommendedOption && preset && (
        <p className="text-xs text-[#737373]">
          <Trans>
            For {i18n._(preset.title)}, we recommend {recommendedOption.label}.
          </Trans>
        </p>
      )}
    </div>
  )
}
