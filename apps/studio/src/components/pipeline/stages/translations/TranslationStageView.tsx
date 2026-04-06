import { useState } from "react"
import { Languages, Volume2 } from "lucide-react"
import { TranslationsView } from "./TranslationsView"
import { SpeechView } from "../speech/SpeechView"
import { cn } from "@/lib/utils"
import { useLingui } from "@lingui/react/macro"

type TabId = "translation" | "speech"

export function TranslationStageView({ bookLabel, selectedPageId, onSelectPage }: { bookLabel: string; selectedPageId?: string; onSelectPage?: (pageId: string | null) => void }) {
  const { t } = useLingui()
  const [activeTab, setActiveTab] = useState<TabId>("translation")

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 px-4 pt-3 flex gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("translation")}
          className={cn(
            "flex items-center gap-1.5 text-xs h-8 px-3.5 rounded-t-md font-medium transition-colors cursor-pointer border border-b-0",
            activeTab === "translation"
              ? "bg-background text-foreground border-border"
              : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Languages className="w-3.5 h-3.5" />
          {t`Translation`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("speech")}
          className={cn(
            "flex items-center gap-1.5 text-xs h-8 px-3.5 rounded-t-md font-medium transition-colors cursor-pointer border border-b-0",
            activeTab === "speech"
              ? "bg-background text-foreground border-border"
              : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Volume2 className="w-3.5 h-3.5" />
          {t`Speech`}
        </button>
      </div>
      <div className="border-t border-border" />

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "translation" ? (
          <TranslationsView bookLabel={bookLabel} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />
        ) : (
          <SpeechView bookLabel={bookLabel} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />
        )}
      </div>
    </div>
  )
}
