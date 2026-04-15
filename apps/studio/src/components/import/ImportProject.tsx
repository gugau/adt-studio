import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  Upload,
  Loader2,
  XCircle,
  Trash2,
  FileText,
  Image,
  Video,
  Globe,
  Building2,
  BookOpen,
  AudioLines,
  HelpCircle,
  Hand,
  List,
  LayoutDashboard,
  Languages,
  AlertCircle,
  type LucideIcon,
} from "lucide-react"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import type { MessageDescriptor } from "@lingui/core"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useImportBook } from "@/hooks/use-books"
import { api } from "@/api/client"
import type { ImportPreview } from "@/api/client"

type OverlayState = "idle" | "dragging" | "error"

const DROP_ZONE_HEIGHT = "h-[334px]"

function formatBytes(bytes: number) {
  /* eslint-disable-next-line lingui/no-unlocalized-strings */
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  /* eslint-disable-next-line lingui/no-unlocalized-strings */
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FEATURE_STAGES: {
  name: string
  label: MessageDescriptor
  icon: LucideIcon
  textColor: string
  bgLight: string
  borderColor: string
}[] = [
  { name: "storyboard", label: msg`Storyboard`, icon: LayoutDashboard, textColor: "text-indigo-600", bgLight: "bg-indigo-50", borderColor: "border-indigo-200" },
  { name: "quizzes", label: msg`Quizzes`, icon: HelpCircle, textColor: "text-orange-600", bgLight: "bg-orange-50", borderColor: "border-orange-200" },
  { name: "captions", label: msg`Image Captions`, icon: Image, textColor: "text-teal-600", bgLight: "bg-teal-50", borderColor: "border-teal-200" },
  { name: "glossary", label: msg`Glossary`, icon: BookOpen, textColor: "text-lime-600", bgLight: "bg-lime-50", borderColor: "border-lime-200" },
  { name: "toc", label: msg`Table of Contents`, icon: List, textColor: "text-amber-600", bgLight: "bg-amber-50", borderColor: "border-amber-200" },
  { name: "translate", label: msg`Translate`, icon: Languages, textColor: "text-blue-600", bgLight: "bg-blue-50", borderColor: "border-blue-200" },
  { name: "speech", label: msg`Speech`, icon: AudioLines, textColor: "text-rose-600", bgLight: "bg-rose-50", borderColor: "border-rose-200" },
]

function FeatureChip({
  icon: Icon,
  label,
  textColor,
  bgLight,
  borderColor,
  done,
}: {
  icon: LucideIcon
  label: string
  textColor: string
  bgLight: string
  borderColor: string
  done: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
        done
          ? `${bgLight} ${borderColor} ${textColor}`
          : "bg-slate-50 border-slate-200 text-slate-400"
      }`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </span>
  )
}

function PreviewCard({ preview, fileName, fileSize }: { preview: ImportPreview; fileName: string; fileSize: number }) {
  const { t, i18n } = useLingui()
  const displayTitle = preview.title ?? preview.label
  const authors = preview.authors.join(", ")
  const doneFeatures = FEATURE_STAGES.filter((f) => preview.stages[f.name]?.status === "done").length

  return (
    <div className="w-full max-w-2xl border border-slate-200 rounded-lg overflow-hidden grid grid-cols-[2fr_1fr]">
      {/* Left — Info */}
      <div className="flex flex-col">
        <div className="px-5 pt-5 pb-3 space-y-1">
          <p className="font-semibold text-lg leading-snug line-clamp-2 text-slate-900">
            {displayTitle}
          </p>
          {authors && (
            <p className="text-slate-600 text-xs leading-tight line-clamp-1">{authors}</p>
          )}
          <p className="text-[11px] text-slate-400 truncate">{fileName} &middot; {formatBytes(fileSize)}</p>
        </div>

        <div className="px-5 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <Trans>Book info</Trans>
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            {preview.publisher && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{preview.publisher}</span>
              </div>
            )}
            {preview.pageCount > 0 && (
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{preview.pageCount} {preview.pageCount === 1 ? t`page` : t`pages`}</span>
              </div>
            )}
            {preview.languageCode && (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="inline-flex items-center rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-300/50">
                  {preview.languageCode.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              {preview.imageCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {preview.imageCount} {preview.imageCount === 1 ? t`image` : t`images`}
                </span>
              )}
              {preview.videoCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {preview.videoCount} {preview.videoCount === 1 ? t`video` : t`videos`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline features */}
        <div className="px-5 pb-4 mt-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <Trans>Pipeline features</Trans> &middot; {doneFeatures}/{FEATURE_STAGES.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FEATURE_STAGES.map((f) => {
              const info = preview.stages[f.name]
              return (
                <FeatureChip
                  key={f.name}
                  icon={f.icon}
                  label={i18n._(f.label)}
                  textColor={f.textColor}
                  bgLight={f.bgLight}
                  borderColor={f.borderColor}
                  done={info?.status === "done"}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Right — Cover */}
      <div className="flex flex-col justify-center items-center border-l border-slate-200 bg-slate-50/50 p-5">
        {preview.coverBase64 ? (
          <img
            src={`data:image/png;base64,${preview.coverBase64}`}
            alt={preview.title ?? preview.label}
            className="w-full max-w-[160px] rounded-sm border border-slate-200 shadow-md object-contain"
          />
        ) : (
          <div className="w-full aspect-[3/4] max-w-[160px] rounded-sm border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-3 shadow-md">
            <BookOpen className="w-10 h-10 text-slate-300" />
            <p className="text-[11px] text-slate-400 font-medium px-4 text-center leading-tight">
              <Trans>No cover available</Trans>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ImportProject() {
  const { t } = useLingui()
  const navigate = useNavigate()
  const importMutation = useImportBook()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<OverlayState>("idle")
  const overlayRef = useRef<OverlayState>("idle")
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function setOverlayState(s: OverlayState) {
    overlayRef.current = s
    setOverlay(s)
  }

  const loadPreview = useCallback(async (file: File) => {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const result = await api.previewImport(file)
      setPreview(result)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : t`Failed to read archive`)
    } finally {
      setPreviewLoading(false)
    }
  }, [t])

  const acceptDrop = useCallback((f: File | undefined) => {
    if (!f) return
    if (!f.name.endsWith(".zip") && f.type !== "application/zip" && f.type !== "application/x-zip-compressed") {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      setOverlayState("error")
      errorTimerRef.current = setTimeout(() => setOverlayState("idle"), 2000)
      return
    }
    setOverlayState("idle")
    setZipFile(f)
    loadPreview(f)
  }, [loadPreview])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      acceptDrop(e.dataTransfer.files[0])
    },
    [acceptDrop],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0]
      if (picked) {
        setZipFile(picked)
        loadPreview(picked)
      }
      e.target.value = ""
    },
    [loadPreview],
  )

  function clearFile() {
    setZipFile(null)
    setPreview(null)
    setPreviewError(null)
  }

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types.includes("Files")) setOverlayState("dragging")
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null && overlayRef.current !== "error") setOverlayState("idle")
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault()
    }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      acceptDrop(e.dataTransfer?.files[0])
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [acceptDrop])

  function handleImport() {
    if (!zipFile) return
    importMutation.mutate(zipFile, {
      onSuccess: () => navigate({ to: "/" }),
    })
  }

  return (
    <>
      {/* Full-screen drag overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 m-1 flex flex-col items-center justify-center rounded-lg pointer-events-none",
          "transition-[opacity,background-color,border-color] duration-300 ease-out",
          overlay === "idle" && "border-4 border-transparent opacity-0",
          overlay === "dragging" &&
            "border-4 border-dashed border-amber-500 bg-amber-500/10 opacity-100",
          overlay === "error" &&
            "border-4 border-dashed border-[#ef4444] bg-[#ef4444]/10 opacity-100",
        )}
        aria-hidden
      >
        <div className="grid min-h-[5.5rem] w-full max-w-md place-items-center px-4">
          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 transition-all duration-300 ease-out",
              overlay === "error"
                ? "pointer-events-none scale-95 opacity-0"
                : "scale-100 opacity-100",
            )}
          >
            <Upload
              className={cn(
                "h-10 w-10 text-amber-500 transition-transform duration-300 ease-out",
                overlay === "dragging" ? "scale-100" : "scale-75",
              )}
            />
            <span className="text-base font-semibold text-amber-600">
              <Trans>Drop ZIP here</Trans>
            </span>
          </div>
          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 transition-all duration-300 ease-out",
              overlay === "error"
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0",
            )}
          >
            <XCircle className="h-10 w-10 text-[#ef4444]" />
            <span className="text-center text-base font-semibold text-[#ef4444]">
              <Trans>Only ZIP files are supported</Trans>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 w-full bg-white flex-col items-center justify-center gap-6 sm:gap-8 px-4 py-10">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl sm:text-[30px] font-semibold leading-tight sm:leading-9 tracking-[-0.75px] text-[#030303] text-center">
            <Trans>Import a Project</Trans>
          </h1>
          <p className="max-w-xl text-center text-sm text-[#525252]">
            {zipFile && preview
              ? <Trans>Review the project details below and confirm the import.</Trans>
              : <Trans>Upload an ADT Studio project archive (.zip) exported by you or shared by a colleague.</Trans>}
          </p>
          {!zipFile && (
            <p className="text-center text-xs text-slate-400">
              <Trans>Don't have a project yet?</Trans>{" "}
              <Link to="/books/new" className="text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors">
                <Trans>Create a new book from a PDF</Trans>
              </Link>
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Content area */}
        <div className={`w-full flex justify-center px-4 ${zipFile && preview ? "" : DROP_ZONE_HEIGHT}`}>
          {zipFile && previewLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              <span className="text-sm text-[#737373]">
                <Trans>Reading archive...</Trans>
              </span>
            </div>
          ) : zipFile && preview ? (
            <div className="relative">
              <PreviewCard preview={preview} fileName={zipFile.name} fileSize={zipFile.size} />
              <button
                type="button"
                onClick={clearFile}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#e5e5e5] text-[#737373] hover:text-[#ef4444] hover:border-[#ef4444]/50 transition-colors shadow-sm"
                aria-label={t`Remove file`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : zipFile && previewError ? (
            <div className="flex flex-col items-center justify-center gap-3 h-full max-w-md">
              <AlertCircle className="h-8 w-8 text-[#ef4444]" />
              <p className="text-sm text-[#ef4444] text-center">{previewError}</p>
              <Button variant="outline" size="sm" onClick={clearFile}>
                <Trans>Try another file</Trans>
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              aria-label={t`Upload ZIP or drag and drop`}
              className="flex flex-col items-center justify-center gap-2 border border-dashed border-[#d4d4d4] rounded-lg w-full max-w-md h-full cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/[0.02] transition-colors duration-200"
            >
              <Upload className="h-5 w-5 text-[#737373]" />
              <span className="text-sm text-[#737373]">
                <Trans>Upload ZIP or drag and drop</Trans>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate({ to: "/" })}
            className="h-9 px-3 py-2 bg-[#f5f5f5] text-[#262626] hover:bg-[#e5e5e5] border-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <Trans>Back</Trans>
          </Button>
          <Button
            disabled={!preview || importMutation.isPending}
            onClick={handleImport}
            className="h-9 px-3 py-2 text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 border-0"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                <Trans>Importing...</Trans>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" />
                <Trans>Import</Trans>
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
