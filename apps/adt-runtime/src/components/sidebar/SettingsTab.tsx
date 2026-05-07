import { useAtom, useAtomValue } from "jotai"
import { ToggleRow } from "./ToggleRow"
import { LanguageSelect } from "./LanguageSelect"
import { appConfigAtom } from "@/state/config.atoms"
import {
  autoplayModeAtom,
  describeImagesModeAtom,
  readAloudModeAtom,
} from "@/state/audio.atoms"
import { stateModeAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"


export function SettingsTab() {
  const { t } = useTranslation()
  const features = useAtomValue(appConfigAtom).features
  const [stateMode, setStateMode] = useAtom(stateModeAtom)
  const [readAloud, setReadAloud] = useAtom(readAloudModeAtom)
  const [autoplay, setAutoplay] = useAtom(autoplayModeAtom)
  const [describeImages, setDescribeImages] = useAtom(describeImagesModeAtom)

  const wrap = (name: string, setter: (v: boolean) => void) => (next: boolean) => {
    trackToggleEvent(name, next)
    setter(next)
  }

  const showTtsSubsettings =
    readAloud && (features.autoplay || features.describeImages)

  return (
    <div className="flex flex-col">
      <LanguageSelect />

      {features.readAloud ? (
        <>
          <ToggleRow
            label={t("tts-label") || "Text to speech"}
            checked={readAloud}
            onChange={wrap("ReadAloud", setReadAloud)}
            borderTop
          />
          {showTtsSubsettings ? (
            <div className="bg-gray-50 rounded-lg border border-gray-200 mt-2 px-3">
              {features.autoplay ? (
                <ToggleRow
                  label={t("autoplay-label") || "Autoplay"}
                  checked={autoplay}
                  onChange={wrap("Autoplay", setAutoplay)}
                />
              ) : null}
              {features.describeImages ? (
                <ToggleRow
                  label={t("describe-images-label") || "Describe images"}
                  checked={describeImages}
                  onChange={wrap("DescribeImages", setDescribeImages)}
                  borderTop={Boolean(features.autoplay)}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {features.showAutoHideButton !== false ? (
        <ToggleRow
          label={t("state-label") || "Hide menus"}
          checked={stateMode}
          onChange={(v) => {
            trackToggleEvent("HideMenus", v)
            setStateMode(v)
          }}
        />
      ) : null}
    </div>
  )
}
