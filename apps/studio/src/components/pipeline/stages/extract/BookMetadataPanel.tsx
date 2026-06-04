import { useMemo, useState } from "react"
import {
  Building2,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import type { BookMetadata } from "@adt/types"
import { useBook, useUpdateBookMetadata } from "@/hooks/use-books"
import { LanguagePicker } from "@/components/LanguagePicker"
import { normalizeLocale } from "@/lib/languages"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useDownstreamWithOutput } from "@/hooks/use-downstream-with-output"
import { CascadeResetDialog } from "@/components/pipeline/components/CascadeResetDialog"

/** Editable book-metadata draft — only the user-editable subset. */
interface MetadataDraft {
  title: string
  authors: string[]
  publisher: string
  language_code: string
}

function toDraft(metadata: BookMetadata): MetadataDraft {
  return {
    title: metadata.title ?? "",
    authors: metadata.authors ?? [],
    publisher: metadata.publisher ?? "",
    language_code: metadata.language_code ?? "",
  }
}

function draftsEqual(a: MetadataDraft, b: MetadataDraft): boolean {
  return (
    a.title === b.title &&
    a.publisher === b.publisher &&
    normalizeLocale(a.language_code) === normalizeLocale(b.language_code) &&
    a.authors.length === b.authors.length &&
    a.authors.every((author, i) => author === b.authors[i])
  )
}

/**
 * Expandable, editable book-metadata panel for the Extract stage. Lets users
 * correct title/authors/publisher/language while leaving the cover page,
 * extraction rationale, and page count read-only. Changing the language warns
 * before saving because it resets the language-dependent downstream stages.
 */
export function BookMetadataPanel({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: book } = useBook(bookLabel)
  const updateMetadata = useUpdateBookMetadata()

  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<MetadataDraft | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const metadata = book?.metadata ?? null
  const original = useMemo(
    () => (metadata ? toDraft(metadata) : null),
    [metadata],
  )
  // A language change resets every language-dependent stage downstream of
  // Storyboard; list only those with committed output, same as the stage
  // re-run cascade warning. (Hook must run before any early return.)
  const affectedStages = useDownstreamWithOutput("storyboard")

  const current = draft ?? original

  if (!book || !metadata || !original || !current) return null

  const dirty = !draftsEqual(current, original)
  const languageChanged =
    normalizeLocale(current.language_code) !== normalizeLocale(original.language_code)
  const needsConfirmation = languageChanged && affectedStages.length > 0

  const update = (patch: Partial<MetadataDraft>) => {
    setDraft({ ...current, ...patch })
  }

  const reset = () => setDraft(null)

  const persist = () => {
    const payload: BookMetadata = {
      ...metadata,
      title: current.title.trim() || null,
      authors: current.authors.map((a) => a.trim()).filter(Boolean),
      publisher: current.publisher.trim() || null,
      language_code: current.language_code
        ? normalizeLocale(current.language_code)
        : null,
    }
    updateMetadata.mutate(
      { label: bookLabel, metadata: payload },
      { onSuccess: () => setDraft(null) },
    )
  }

  const handleSave = () => {
    if (needsConfirmation) {
      setConfirmOpen(true)
    } else {
      persist()
    }
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">
          <Trans>Book metadata</Trans>
        </span>
        {dirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <Trans>Unsaved</Trans>
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t px-4 py-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              <Trans>Title</Trans>
            </Label>
            <Input
              value={current.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder={t`Book title`}
            />
          </div>

          {/* Authors */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <User className="h-3 w-3" />
              <Trans>Authors</Trans>
            </Label>
            <div className="space-y-1.5">
              {current.authors.map((author, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={author}
                    onChange={(e) => {
                      const authors = [...current.authors]
                      authors[i] = e.target.value
                      update({ authors })
                    }}
                    placeholder={t`Author name`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t`Remove author`}
                    onClick={() =>
                      update({ authors: current.authors.filter((_, j) => j !== i) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update({ authors: [...current.authors, ""] })}
              >
                <Plus className="h-3.5 w-3.5" />
                <Trans>Add author</Trans>
              </Button>
            </div>
          </div>

          {/* Publisher */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Building2 className="h-3 w-3" />
              <Trans>Publisher</Trans>
            </Label>
            <Input
              value={current.publisher}
              onChange={(e) => update({ publisher: e.target.value })}
              placeholder={t`Publisher`}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <LanguagePicker
              selected={current.language_code}
              onSelect={(v) => update({ language_code: v })}
              label={t`Original language`}
              hint={t`Add the region (e.g. Spanish — Uruguay) so downstream stages use the right localization.`}
              size="default"
            />
          </div>

          {/* Read-only fields */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              <Trans>{book.pageCount} pages</Trans>
            </span>
            {metadata.cover_page_number != null && (
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                <Trans>Cover: page {String(metadata.cover_page_number)}</Trans>
              </span>
            )}
          </div>

          {/* Extraction rationale (read-only) */}
          {metadata.reasoning && (
            <details className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
                <Sparkles className="h-3 w-3" />
                <Trans>Extraction notes</Trans>
              </summary>
              <p className="mt-2 leading-relaxed">{metadata.reasoning}</p>
            </details>
          )}

          {updateMetadata.isError && (
            <p className="text-xs text-destructive">
              <Trans>Failed to save metadata. Please try again.</Trans>
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!dirty || updateMetadata.isPending}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || updateMetadata.isPending}
            >
              {updateMetadata.isPending ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
            </Button>
          </div>
        </div>
      )}

      <CascadeResetDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        affectedStages={affectedStages}
        headerStageSlug="extract"
        title={<Trans>Change the book language?</Trans>}
        description={
          <Trans>
            The completed stages below will be reset and need to run again so
            they use the new language. Your page sections are kept.
          </Trans>
        }
        confirmLabel={<Trans>Change language</Trans>}
        confirmColorClass="bg-blue-600 hover:bg-blue-700"
        onConfirm={() => {
          setConfirmOpen(false)
          persist()
        }}
      />
    </div>
  )
}
