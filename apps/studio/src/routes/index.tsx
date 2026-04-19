import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Plus,
  ArrowRight,
  BookOpen,
  Trash2,
  FileText,
  Building2,
  User,
  Globe,
  Pencil,
  Filter,
} from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import { StudioTopBar } from "@/components/StudioTopBar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeleteBookDialog } from "@/components/books/DeleteBookDialog"
import { StageFilterCombobox } from "@/components/books/StageFilterCombobox"
import { useBooks, useDeleteBook } from "@/hooks/use-books"
import {
  getPipelineStages,
  type PipelineStageDefinition,
} from "@/components/pipeline/stage-config"
import {
  getStageLabelI18n,
  getStageDescriptionI18n,
} from "@/components/pipeline/pipeline-i18n"
import type { BookSummary } from "@/api/client"

type BookSortKey = "modified" | "created" | "alphabetical"

const BOOK_SORT_STORAGE_KEY = "adt.books.sort"
const VALID_SORT_KEYS: readonly BookSortKey[] = [
  "modified",
  "created",
  "alphabetical",
]

function readStoredSort(): BookSortKey {
  if (typeof window === "undefined") return "modified"
  const stored = window.localStorage.getItem(BOOK_SORT_STORAGE_KEY)
  return VALID_SORT_KEYS.includes(stored as BookSortKey)
    ? (stored as BookSortKey)
    : "modified"
}

function sortBooks(books: BookSummary[], key: BookSortKey): BookSummary[] {
  const copy = [...books]
  switch (key) {
    case "modified":
      return copy.sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
      )
    case "created":
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    case "alphabetical":
      return copy.sort((a, b) =>
        (a.title ?? a.label).localeCompare(b.title ?? b.label, undefined, {
          sensitivity: "base",
        }),
      )
  }
}

const STAGE_FILTER_STORAGE_KEY = "adt.books.stage-filter"

function readStoredStageFilter(validSlugs: Set<string>): string[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(STAGE_FILTER_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (slug): slug is string =>
        typeof slug === "string" && validSlugs.has(slug),
    )
  } catch {
    return []
  }
}

export const Route = createFileRoute("/")({
  component: HomePage,
})

/** Pipeline stages shown in the sidebar (skip the "book" overview entry) */
const PIPELINE_STEPS = getPipelineStages()

function CompletedStageBadges({
  completedSet,
  pipelineStages,
}: {
  completedSet: Set<string>
  pipelineStages: readonly PipelineStageDefinition[]
}) {
  const visibleStages = pipelineStages.filter((s) => completedSet.has(s.slug))
  if (visibleStages.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {visibleStages.map((stage) => {
        const Icon = stage.icon
        return (
          <span
            key={stage.slug}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${stage.bgLight} ${stage.textColor} ${stage.borderColor}`}
          >
            <Icon className="h-3 w-3" />
            {getStageLabelI18n(stage.slug)}
          </span>
        )
      })}
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}

function BookRow({
  book,
  onDelete,
  pipelineStages,
}: {
  book: BookSummary
  onDelete: (label: string) => void
  pipelineStages: readonly PipelineStageDefinition[]
}) {
  const { t } = useLingui()
  const hasMetadata = book.title || book.authors.length > 0
  const completedSet = useMemo(
    () => new Set(book.completedStages),
    [book.completedStages],
  )
  return (
    <div className="group rounded-xl border bg-card transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-stretch">
        {/* Main content — clickable */}
        <Link
          to="/books/$label/$step"
          params={{ label: book.label, step: "extract" }}
          className="flex-1 min-w-0 p-5"
        >
          {/* Top: title + badges */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-base truncate">
                {book.title ?? book.label}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {book.needsRebuild && (
                <Badge variant="destructive" className="text-[11px] px-2 py-0.5">
                  <Trans>Needs rebuild</Trans>
                </Badge>
              )}
              {book.languageCode && (
                <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                  {book.languageCode.toUpperCase()}
                </Badge>
              )}
              {!book.needsRebuild && (
                <Badge
                  variant={book.pageCount > 0 ? "default" : "secondary"}
                  className="text-[11px] px-2 py-0.5"
                >
                  {book.pageCount > 0
                    ? `${book.pageCount} ${
                        book.pageCount === 1
                          ? t`page`
                          : t`pages`
                      }`
                    : <Trans>New</Trans>}
                </Badge>
              )}
              {!book.hasSourcePdf && (
                <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                  <Trans>No PDF</Trans>
                </Badge>
              )}
            </div>
          </div>

          {/* Rebuild warning */}
          {book.needsRebuild && (
            <p className="text-sm text-destructive mb-2">
              {book.rebuildReason ?? t`Book data is outdated and must be rebuilt.`}
            </p>
          )}

          {/* Details */}
          {hasMetadata ? (
            <div className="space-y-1.5">
              {book.title && (
                <DetailRow icon={FileText} label={t`Label`} value={book.label} />
              )}
              {book.authors.length > 0 && (
                <DetailRow
                  icon={User}
                  label={book.authors.length > 1 ? t`Authors` : t`Author`}
                  value={book.authors.join(", ")}
                />
              )}
              {book.publisher && (
                <DetailRow
                  icon={Building2}
                  label={t`Publisher`}
                  value={book.publisher}
                />
              )}
              {book.languageCode && (
                <DetailRow
                  icon={Globe}
                  label={t`Language`}
                  value={book.languageCode.toUpperCase()}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              <Trans>No metadata yet — run the pipeline to extract book details</Trans>
            </p>
          )}

          <CompletedStageBadges
            completedSet={completedSet}
            pipelineStages={pipelineStages}
          />
        </Link>

        {/* Actions — always visible */}
        <div className="flex flex-col items-center justify-center gap-1 border-l px-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            asChild
          >
            <Link to="/books/$label/$step" params={{ label: book.label, step: "extract" }}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(book.label)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  const { t } = useLingui()
  const { data: books, isLoading, error } = useBooks()
  const deleteMutation = useDeleteBook()
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<BookSortKey>(() => readStoredSort())

  const pipelineStageSlugSet = useMemo(
    () => new Set(PIPELINE_STEPS.map((s) => s.slug)),
    [],
  )
  const [selectedStages, setSelectedStages] = useState<Set<string>>(() =>
    new Set(readStoredStageFilter(pipelineStageSlugSet)),
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(BOOK_SORT_STORAGE_KEY, sortKey)
  }, [sortKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      STAGE_FILTER_STORAGE_KEY,
      JSON.stringify([...selectedStages]),
    )
  }, [selectedStages])

  const toggleStageFilter = (slug: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const clearStageFilters = () => setSelectedStages(new Set())

  const filteredBooks = useMemo(() => {
    const list = books ?? []
    if (selectedStages.size === 0) return list
    return list.filter((book) => {
      const completed = new Set(book.completedStages)
      for (const slug of selectedStages) {
        if (!completed.has(slug)) return false
      }
      return true
    })
  }, [books, selectedStages])

  const visibleBooks = useMemo(
    () => sortBooks(filteredBooks, sortKey),
    [filteredBooks, sortKey],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted-foreground">
        <Trans>Loading books...</Trans>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 text-destructive">
        <Trans>Failed to load books: {error.message}</Trans>
      </div>
    )
  }

  const totalBooks = books?.length ?? 0
  const hasActiveFilter = selectedStages.size > 0
  const hiddenByFilter = hasActiveFilter && totalBooks > 0 && visibleBooks.length === 0

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <StudioTopBar />

      <div className="flex flex-1 min-h-0">
      {/* Left — pipeline stages (30%) */}
      <div className="w-[30%] shrink-0 border-r bg-muted/30 flex flex-col overflow-auto">
        <div className="px-5 pt-5 pb-5 flex-1">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            <Trans>Pipeline Stages</Trans>
          </h2>
          <div className="space-y-1">
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon
              const label = getStageLabelI18n(step.slug)
              const description = getStageDescriptionI18n(step.slug) ?? ""

              return (
                <div
                  key={step.slug}
                  className="flex gap-3 p-2.5 rounded-lg"
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.color} text-white`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <span className="text-sm font-medium">{label}</span>
                    {!!description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Link
            to="/books/new"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Trans>Get started</Trans> <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Right — books list (70%) */}
      <div className="flex-1 min-w-0 overflow-auto p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            <Trans>Your Books</Trans>
            {totalBooks > 0 && (
              <span
                key={hasActiveFilter ? `${visibleBooks.length}/${totalBooks}` : `${totalBooks}`}
                className="ml-1 inline-block animate-count-pulse"
              >
                {hasActiveFilter
                  ? `(${visibleBooks.length}/${totalBooks})`
                  : `(${totalBooks})`}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {totalBooks > 1 && (
              <StageFilterCombobox
                pipelineStages={PIPELINE_STEPS}
                selectedStages={selectedStages}
                onToggle={toggleStageFilter}
                onClear={clearStageFilters}
              />
            )}
            {totalBooks > 1 && (
              <Select
                value={sortKey}
                onValueChange={(value) => setSortKey(value as BookSortKey)}
              >
                <SelectTrigger
                  aria-label={t`Sort books`}
                  className="h-8 w-[160px] text-xs transition-colors"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="modified">
                    <Trans>Last modified</Trans>
                  </SelectItem>
                  <SelectItem value="created">
                    <Trans>Newest first</Trans>
                  </SelectItem>
                  <SelectItem value="alphabetical">
                    <Trans>A–Z</Trans>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/books/new" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <Trans>Add Book</Trans>
              </Link>
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {visibleBooks.map((book) => (
            <div key={book.label} className="animate-wizard-enter">
              <BookRow
                book={book}
                onDelete={setDeleteLabel}
                pipelineStages={PIPELINE_STEPS}
              />
            </div>
          ))}
          {hiddenByFilter && (
            <div className="flex animate-wizard-enter flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">
                <Trans>No books match your filters</Trans>
              </span>
              <button
                type="button"
                onClick={clearStageFilters}
                className="mt-2 text-xs text-primary transition-colors hover:underline"
              >
                <Trans>Clear filters</Trans>
              </button>
            </div>
          )}
          {!hiddenByFilter && visibleBooks.length === 0 && (
            <Link to="/books/new" className="block animate-wizard-enter">
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 py-16 transition-all hover:border-primary/40 hover:bg-primary/5 cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium">
                  <Trans>Add your first book</Trans>
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  <Trans>Upload a PDF to get started</Trans>
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>
      </div>

      <DeleteBookDialog
        label={deleteLabel}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteLabel) {
            deleteMutation.mutate(deleteLabel, {
              onSuccess: () => setDeleteLabel(null),
            })
          }
        }}
        onCancel={() => setDeleteLabel(null)}
      />
    </div>
  )
}
