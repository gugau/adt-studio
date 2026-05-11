import { useState, useEffect, useMemo } from "react"
import { BookOpen, GraduationCap, Sparkles, Sprout } from "lucide-react"
import { CustomInstructionsField } from "@/components/pipeline/components/CustomInstructionsField"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n as linguiI18n } from "@lingui/core"
import type { MessageDescriptor } from "@lingui/core"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { useComposeBookContext } from "@/hooks/use-compose-book-context"
import { ACCENT_VAR, ACCENT_VAR_SOFT } from "@/components/pipeline/lib/accent-var"

type GradeLevelKey = "early" | "middle" | "advanced"

const GRADE_LEVEL_HINTS: Record<GradeLevelKey, MessageDescriptor> = {
  early: msg`Short, simple sentences for kindergarten through 5th grade.`,
  middle: msg`Clear, descriptive captions for middle and high school readers.`,
  advanced: msg`Detailed, technical captions for college and adult readers.`,
}

const CAPTION_SAMPLES: Record<GradeLevelKey, MessageDescriptor> = {
  early: msg`A long row of shelves filled with food in a big store.`,
  middle: msg`A supermarket aisle with shelves of colorful cereal boxes and packaged goods, lit by overhead lights, with a single shopper in the distance.`,
  advanced: msg`A wide-angle view down a fluorescent-lit supermarket aisle, with stacked branded cereal boxes lining the left shelves and assorted packaged dry goods on the right; a lone shopper stands at the far end, providing scale to the receding perspective.`,
}

export function CaptionsLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("captions")
  const storyboardStatus = useStageStatus("storyboard")
  const storyboardReady = storyboardStatus.isCompleted
  const { compose: composeBookContext, canAutoFill } = useComposeBookContext(
    bookLabel,
    t`When describing images, mention any culturally specific objects, locations, or recurring characters by name.`,
  )

  const [gradeLevel, setGradeLevel] = useState<GradeLevelKey>("middle")
  const [userPrompt, setUserPrompt] = useState("")

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (
      m.image_captioning_grade_level === "early" ||
      m.image_captioning_grade_level === "middle" ||
      m.image_captioning_grade_level === "advanced"
    ) {
      setGradeLevel(m.image_captioning_grade_level)
    }
    if (typeof m.image_captioning_user_prompt === "string") {
      setUserPrompt(m.image_captioning_user_prompt)
    }
  }, [activeConfigData])

  const handleGradeChange = (value: GradeLevelKey) => {
    setGradeLevel(value)
    persist({ image_captioning_grade_level: value })
  }

  const handleUserPromptChange = (value: string) => {
    setUserPrompt(value)
    persist({ image_captioning_user_prompt: value })
  }

  const handleRun = () => {
    if (!hasApiKey || !storyboardReady || status.isRunning) return
    queueRun({ fromStage: "captions", toStage: "captions", apiKey })
  }

  const gradeOptions = useMemo(
    () => [
      {
        value: "early" as const,
        label: t`Early`,
        icon: <Sprout className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
      },
      {
        value: "middle" as const,
        label: t`Middle`,
        icon: <BookOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
      },
      {
        value: "advanced" as const,
        label: t`Advanced`,
        icon: (
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        ),
      },
    ],
    [t],
  )

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run captions.</Trans>
  ) : !storyboardReady ? (
    <Trans>Run Storyboard first — captions describe the images placed by Storyboard.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="captions"
      settingsTab="general"
      colorClass="bg-teal-600 hover:bg-teal-700"
      accentColor="#0d9488"
      accentColorSoft="#ccfbf1"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Captions</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Captions Preview`}
      onRun={handleRun}
      preview={<CaptionsPreview grade={gradeLevel} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Image Captions</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate descriptive captions for every image in the book. Pick a
            reading level so captions match your audience, and add custom
            instructions if you want to nudge the tone or focus.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="storyboard"
        stageSlug="captions"
        description={
          <Trans>
            Captions describe the images that Storyboard places into pages.
            Finish Storyboard before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Grade Level</Trans>}
          hint={linguiI18n._(GRADE_LEVEL_HINTS[gradeLevel])}
        >
          <SegmentedControl
            options={gradeOptions}
            value={gradeLevel}
            onValueChange={handleGradeChange}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Custom Instructions</Trans>}
          hint={
            <Trans>
              Optional. Add notes about tone, focus, or vocabulary. Use
              Auto-fill to start from the book's title, language, and summary.
            </Trans>
          }
        >
          <CustomInstructionsField
            value={userPrompt}
            onChange={handleUserPromptChange}
            compose={composeBookContext}
            canAutoFill={canAutoFill}
            accentHex="#0d9488"
            dialogDescription={t`Optional notes to steer how captions are generated. Use Auto-fill to start from the book's title, language, and summary.`}
            placeholder={t`e.g. emphasize cultural context, avoid technical jargon, mention colors when relevant…`}
          />
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}

function CaptionsPreview({ grade }: { grade: GradeLevelKey }) {
  /* eslint-disable lingui/no-unlocalized-strings -- mock textbook content, illustrative only */
  return (
    <div className="flex flex-1 min-h-0 gap-4 bg-white px-6 py-6">
      {/* Left column — placeholder body text (lorem ipsum, locale-agnostic) */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <p className="text-center text-base font-semibold leading-snug tracking-tight text-foreground">
          Lorem ipsum
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
          ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Duis aute irure dolor in reprehenderit in voluptate velit esse
          cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
          cupidatat non proident, sunt in culpa qui officia deserunt mollit
          anim id est laborum.
        </p>
        <div className="text-[11px] leading-[15px] text-justify text-foreground/70">
          <p>Sed ut perspiciatis unde omnis iste natus error:</p>
          <ul className="list-disc ml-3 mt-1 space-y-0.5">
            <li>
              <span>
                Voluptatem accusantium doloremque laudantium totam rem
                aperiam.
              </span>
            </li>
            <li>
              <span>
                Eaque ipsa quae ab illo inventore veritatis et quasi
                architecto.
              </span>
            </li>
            <li>
              <span>
                Beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem.
              </span>
            </li>
          </ul>
        </div>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Quia voluptas sit aspernatur aut odit aut fugit, sed quia
          consequuntur magni dolores eos qui ratione voluptatem sequi
          nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor
          sit amet.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Consectetur, adipisci velit, sed quia non numquam eius modi tempora
          incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
        </p>
      </div>

      {/* Right column — text + image + alt-text card + text */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
          ad minim veniam, quis nostrud exercitation.
        </p>

        {/* Demo image — supermarket aisle (Unsplash, free to use). The
            alt-text card is positioned absolutely just below the image so it
            can grow with caption length without reflowing the page text. */}
        <div className="relative shrink-0">
          <img
            src="/previews/supermarket-aisle.jpg"
            alt=""
            className="aspect-[4/3] w-full rounded-sm border-2 object-cover"
            style={{ borderColor: ACCENT_VAR }}
          />
          <div className="absolute inset-x-0 top-full z-10 mt-2">
            <AltTextCard grade={grade} />
          </div>
        </div>

        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
          nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
          officia deserunt mollit anim id est laborum.
        </p>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

function AltTextCard({ grade }: { grade: GradeLevelKey }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-md border border-[#e5e5e5] bg-white p-2.5 shadow-[0px_4px_10px_0px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out">
      <div className="flex items-center gap-1.5">
        <div
          className="shrink-0 rounded-full p-1"
          style={{ background: ACCENT_VAR_SOFT }}
        >
          <Sparkles
            className="h-3 w-3"
            strokeWidth={2}
            style={{ color: ACCENT_VAR }}
            aria-hidden
          />
        </div>
        <span className="text-[11px] font-semibold tracking-tight text-black">
          <Trans>Image Alt-Text</Trans>
        </span>
      </div>
      <p
        key={grade}
        className="text-[10px] font-medium leading-[13px] text-black text-justify motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-safe:ease-out"
      >
        &ldquo;{linguiI18n._(CAPTION_SAMPLES[grade])}&rdquo;
      </p>
      <p className="text-[9px] font-medium text-[#99a1af]">
        <Trans>This text is only perceptible to assistive technologies.</Trans>
      </p>
    </div>
  )
}
