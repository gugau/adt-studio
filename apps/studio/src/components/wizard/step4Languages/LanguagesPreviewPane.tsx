/* eslint-disable lingui/no-unlocalized-strings */
import type { ReactNode } from "react"
import { Languages, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDisplayName } from "@/lib/languages"

function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]">
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Languages
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">{children}</div>
    </div>
  )
}

function LanguageChip({
  code,
  variant = "muted",
}: {
  code: string
  variant?: "muted" | "primary"
}) {
  const name = getDisplayName(code) || code
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        variant === "primary"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-white text-foreground",
      )}
    >
      <span className="text-xs font-medium">{name}</span>
      <span className="text-[10px] text-muted-foreground">{code}</span>
    </div>
  )
}

export function LanguagesPreviewPane({
  editingLanguage,
  outputLanguages,
}: {
  editingLanguage: string
  outputLanguages: string[]
}) {
  const hasEditing = editingLanguage.trim() !== ""
  const hasOutput = outputLanguages.length > 0

  if (!hasEditing && !hasOutput) {
    return (
      <PreviewShell>
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
            <Languages className="h-7 w-7" />
          </div>
          <div className="max-w-[280px] text-center">
            <p className="text-base font-semibold text-foreground">Language Setup</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose an editing language and output languages to see how your book will be processed
              and translated.
            </p>
          </div>
        </div>
      </PreviewShell>
    )
  }

  return (
    <PreviewShell>
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-8 px-6 py-8">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Editing Language
          </p>
          {hasEditing ? (
            <LanguageChip code={editingLanguage} variant="primary" />
          ) : (
            <p className="max-w-[220px] text-center text-xs leading-relaxed text-muted-foreground">
              Defaults to the book's own language
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Output Languages
          </p>
          {hasOutput ? (
            <div className="flex flex-wrap justify-center gap-2">
              {outputLanguages.map((code) => (
                <LanguageChip key={code} code={code} />
              ))}
            </div>
          ) : (
            <p className="max-w-[220px] text-center text-xs leading-relaxed text-muted-foreground">
              Defaults to the book's own language
            </p>
          )}
        </div>
      </div>
    </PreviewShell>
  )
}
