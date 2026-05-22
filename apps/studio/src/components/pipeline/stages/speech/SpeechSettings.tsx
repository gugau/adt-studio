import { LanguageSettings } from "../languages/LanguageSettings"

/**
 * Speech-stage settings. Today delegates to the shared `LanguageSettings`
 * implementation with `stageSlug="speech"` so the deep `isSpeechStage`
 * branches inside it render the audio/voice configuration UI.
 *
 * The longer-term goal is to migrate speech-only paths into this file.
 */
export function SpeechSettings({
  bookLabel,
  headerTarget,
  tab,
}: {
  bookLabel: string
  headerTarget?: HTMLDivElement | null
  tab?: string
}) {
  return (
    <LanguageSettings
      bookLabel={bookLabel}
      headerTarget={headerTarget}
      tab={tab}
      stageSlug="speech"
    />
  )
}
