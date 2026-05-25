import { useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import type { VersionEntry } from "@/api/client"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type VersionedStep =
  | "toc-generation"
  | "glossary"
  | "quiz-generation"
  | "text-catalog-translation"
  | "image-filtering"
  | "image-captioning"
  | "page-sectioning"
  | "web-rendering"

type Variant = "header" | "muted"

interface StepStyling {
  variant: Variant
  triggerClass: string
  discardClass: string
  saveClass: string
}

const HEADER_DISCARD = "bg-black/40 text-white hover:bg-black/55"
const HEADER_TRIGGER = "bg-white/20 text-white hover:bg-white/30"

const MUTED_TRIGGER = "bg-muted hover:bg-muted/80"
const MUTED_DISCARD = "bg-muted hover:bg-accent hover:text-accent-foreground"

const STEP_STYLING: Record<VersionedStep, StepStyling> = {
  "toc-generation": {
    variant: "header",
    triggerClass: HEADER_TRIGGER,
    discardClass: HEADER_DISCARD,
    saveClass: "bg-white text-amber-800 hover:bg-white/80",
  },
  glossary: {
    variant: "header",
    triggerClass: HEADER_TRIGGER,
    discardClass: HEADER_DISCARD,
    saveClass: "bg-white text-lime-800 hover:bg-white/80",
  },
  "quiz-generation": {
    variant: "header",
    triggerClass: HEADER_TRIGGER,
    discardClass: HEADER_DISCARD,
    saveClass: "bg-white text-orange-800 hover:bg-white/80",
  },
  "text-catalog-translation": {
    variant: "header",
    triggerClass: HEADER_TRIGGER,
    discardClass: HEADER_DISCARD,
    saveClass: "bg-white text-pink-800 hover:bg-white/80",
  },
  "web-rendering": {
    variant: "header",
    triggerClass: HEADER_TRIGGER,
    discardClass: HEADER_DISCARD,
    saveClass: "bg-white text-violet-800 hover:bg-white/80",
  },
  "image-filtering": {
    variant: "muted",
    triggerClass: MUTED_TRIGGER,
    discardClass: MUTED_DISCARD,
    saveClass: "bg-blue-700 hover:bg-blue-600 text-white",
  },
  "image-captioning": {
    variant: "muted",
    triggerClass: MUTED_TRIGGER,
    discardClass: MUTED_DISCARD,
    saveClass: "bg-teal-700 hover:bg-teal-600 text-white",
  },
  "page-sectioning": {
    variant: "muted",
    triggerClass: MUTED_TRIGGER,
    discardClass: MUTED_DISCARD,
    saveClass: "bg-violet-700 hover:bg-violet-600 text-white",
  },
}

interface VersionPickerProps {
  step: VersionedStep
  itemId: string
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  onPreview: (data: unknown) => void
  onSave?: () => void
  onDiscard: () => void
  saveDisabledReason?: string
}

export function VersionPicker({
  step,
  itemId,
  currentVersion,
  saving,
  dirty,
  bookLabel,
  onPreview,
  onSave,
  onDiscard,
  saveDisabledReason,
}: VersionPickerProps) {
  const { t } = useLingui()
  const styling = STEP_STYLING[step]
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(false)

  if (saving) {
    return (
      <Loader2
        className={`h-3 w-3 animate-spin ${styling.variant === "header" ? "text-white/60" : ""}`}
      />
    )
  }

  if (currentVersion == null) return null

  if (dirty) {
    const saveDisabled = !!saveDisabledReason
    const saveButton = onSave && (
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={`flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styling.saveClass}`}
      >
        <Check className="h-3 w-3" />
        {t`Save`}
      </button>
    )

    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className={`text-[10px] font-medium rounded px-2 py-0.5 cursor-pointer transition-colors ${styling.discardClass}`}
        >
          {t`Discard`}
        </button>
        {saveButton && saveDisabled ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{saveButton}</span>
              </TooltipTrigger>
              <TooltipContent>{saveDisabledReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          saveButton
        )}
      </div>
    )
  }

  const handleOpenChange = async (next: boolean) => {
    setOpen(next)
    if (next && versions == null) {
      setLoadingVersions(true)
      const res = await api.getVersionHistory(bookLabel, step, itemId, true)
      setVersions(res.versions)
      setLoadingVersions(false)
    }
  }

  const handlePick = (v: VersionEntry) => {
    setOpen(false)
    if (v.version === currentVersion) return
    onPreview(v.data)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal rounded px-1.5 py-0.5 transition-colors ${styling.triggerClass}`}
        >
          v{currentVersion}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-[80px] p-1">
        {loadingVersions ? (
          <div className="flex items-center justify-center py-2 px-3">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        ) : versions && versions.length > 0 ? (
          versions.map((v) => (
            <button
              key={v.version}
              type="button"
              onClick={() => handlePick(v)}
              className={`block w-full text-left px-3 py-1 text-xs rounded hover:bg-accent transition-colors ${
                v.version === currentVersion
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              v{v.version}
            </button>
          ))
        ) : (
          <div className="px-3 py-1 text-xs text-muted-foreground">
            {t`No versions`}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
