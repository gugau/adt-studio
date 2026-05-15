import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Check, CheckCircle2, XCircle, ChevronDown, HelpCircle, Loader2, ImageOff, Eye, Scissors, Trash2, BookOpen, FileQuestion, Pencil, RotateCcw, Save, ImagePlus, Upload, X, Image as ImageIcon, Sparkles } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { api, BASE_URL } from "@/api/client"
import type {
  ActivityGenerationMode,
  ActivityTemplate,
  ActivityTemplateStyle,
  QuizActivityType,
  QuizImageAsset,
  QuizGenerationOutput,
  QuizItem,
  QuizQuestion,
  StageRunProviderCredentials,
  TextbookActivity,
  TextbookActivityOverrideInput,
  VersionEntry,
} from "@/api/client"
import { useQuizzes, useTextbookActivities } from "@/hooks/use-quizzes"
import { usePageImage, usePages } from "@/hooks/use-pages"
import { useBookConfig } from "@/hooks/use-book-config"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useStepHeader } from "../../components/StepViewRouter"
import { useApiKey } from "@/hooks/use-api-key"
import { useSectionNav } from "@/routes/books.$label"
import { getRequestedPageId, getQuizImageRenderState } from "./lib/quizzes-image-state"
import { QuizzesLandingConfig } from "./components/QuizzesLandingConfig"
import { useLingui } from "@lingui/react/macro"


type QuizData = QuizGenerationOutput
type QuizSourceMode = "ai" | "textbook"

function getQuizQuestions(quiz: QuizItem): QuizQuestion[] {
  if (quiz.questions && quiz.questions.length > 0) return quiz.questions
  return [{
    activityType: quiz.activityType ?? "multiple_choice",
    question: quiz.question,
    options: quiz.options,
    answerIndex: quiz.answerIndex,
    answerIndexes: quiz.answerIndexes,
    statements: quiz.statements,
    blanks: quiz.blanks,
    pairs: quiz.pairs,
    categories: quiz.categories,
    sortingItems: quiz.sortingItems,
    sampleAnswer: quiz.sampleAnswer,
    guidance: quiz.guidance,
    responseCharacterLimit: quiz.responseCharacterLimit,
    reasoning: quiz.reasoning,
  }]
}

function syncQuizFromQuestions(quiz: QuizItem, questions: QuizQuestion[]): QuizItem {
  const first = questions[0] ?? getQuizQuestions(quiz)[0]
  return {
    ...quiz,
    activityType: first.activityType,
    question: first.question,
    options: first.options,
    answerIndex: first.answerIndex,
    answerIndexes: first.answerIndexes,
    statements: first.statements,
    blanks: first.blanks,
    pairs: first.pairs,
    categories: first.categories,
    sortingItems: first.sortingItems,
    sampleAnswer: first.sampleAnswer,
    guidance: first.guidance,
    responseCharacterLimit: first.responseCharacterLimit,
    reasoning: first.reasoning,
    questions,
  }
}

function getSharedQuestionTitle(questions: QuizQuestion[]): string | null {
  if (questions.length === 0) return null
  const first = questions[0].question.trim()
  if (!first) return null
  return questions.every((q) => q.question.trim() === first) ? first : null
}

function pad3(n: number): string {
  return String(n).padStart(3, "0")
}

function activityBadgeClass(activityType: QuizActivityType): string {
  switch (activityType) {
    case "multiple_select":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "true_false":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "fill_in_the_blank":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "open_ended":
      return "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
    case "drag_and_drop":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "sorting":
      return "bg-violet-50 text-violet-700 border-violet-200"
    case "multiple_choice":
    default:
      return "bg-orange-50 text-orange-700 border-orange-200"
  }
}

type BookImageEntry = {
  imageId: string
  pageId: string
  width: number
  height: number
  source: string
  caption?: string
}

function quizImageUrl(bookLabel: string, imageId: string): string {
  return `${BASE_URL}/books/${bookLabel}/images/${encodeURIComponent(imageId)}`
}

function quizImageHasAlt(image: QuizImageAsset | undefined): boolean {
  return Boolean(image?.imageId && image.alt?.trim())
}

function collectQuestionImages(question: QuizQuestion): QuizImageAsset[] {
  const images: QuizImageAsset[] = []
  const add = (image: QuizImageAsset | undefined) => {
    if (image?.imageId) images.push(image)
  }
  for (const option of question.options ?? []) add(option.image)
  for (const pair of question.pairs ?? []) {
    add(pair.itemImage)
    add(pair.matchImage)
  }
  for (const item of question.sortingItems ?? []) add(item.image)
  return images
}

function QuizImageButton({
  bookLabel,
  uploadPageId,
  apiKey,
  providerCredentials,
  image,
  onChange,
  label,
}: {
  bookLabel: string
  uploadPageId: string
  apiKey: string
  providerCredentials?: StageRunProviderCredentials
  image?: QuizImageAsset
  onChange: (image: QuizImageAsset | undefined) => void
  label: string
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<BookImageEntry[]>([])
  const [selectedImageId, setSelectedImageId] = useState(image?.imageId ?? "")
  const [altDraft, setAltDraft] = useState(image?.alt ?? "")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [captioning, setCaptioning] = useState(false)
  const [autoCaptionUpload, setAutoCaptionUpload] = useState(Boolean(apiKey))
  const [error, setError] = useState<string | null>(null)
  const [captionNotice, setCaptionNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedImageId(image?.imageId ?? "")
    setAltDraft(image?.alt ?? "")
    setError(null)
    setCaptionNotice(null)
    setAutoCaptionUpload(Boolean(apiKey))
    setLoading(true)
    Promise.all([
      api.listBookImages(bookLabel),
      api.listCaptionedImages(bookLabel).catch(() => ({ images: [] })),
    ])
      .then(([result, captioned]) => {
        const captionByImageId = new Map(captioned.images.map((entry) => [entry.imageId, entry.caption]))
        setImages(result.images.map((entry) => ({
          ...entry,
          caption: captionByImageId.get(entry.imageId),
        })))
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [apiKey, bookLabel, image?.alt, image?.imageId, open])

  const selectedImage = images.find((candidate) => candidate.imageId === selectedImageId)
  const invalidateCaptionQueries = async (pageId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] }),
    ])
  }
  const generateCaptionForImage = async (imageId: string, pageId: string): Promise<string | null> => {
    if (!apiKey) {
      setError(t`Add an API key to generate captions.`)
      return null
    }
    setCaptioning(true)
    setError(null)
    setCaptionNotice(null)
    try {
      const result = await api.generateImageCaption(bookLabel, pageId, imageId, apiKey, providerCredentials)
      const caption = result.caption.caption.trim()
      setImages((current) => current.map((candidate) =>
        candidate.imageId === imageId ? { ...candidate, caption } : candidate
      ))
      setAltDraft(caption || imageId)
      setCaptionNotice(t`Caption synced to Image Captions.`)
      await invalidateCaptionQueries(pageId)
      return caption || imageId
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(t`Caption generation failed: ${message}`)
      return null
    } finally {
      setCaptioning(false)
    }
  }
  const attachImage = () => {
    if (!selectedImageId) return
    onChange({
      imageId: selectedImageId,
      alt: altDraft.trim() || selectedImage?.imageId || selectedImageId,
    })
    setOpen(false)
  }

  const uploadImage = async (file: File | null | undefined) => {
    if (!file) return
    if (!uploadPageId) {
      setError(t`Choose a page before uploading an image.`)
      return
    }
    setUploading(true)
    setError(null)
    setCaptionNotice(null)
    try {
      const uploaded = await api.uploadNewImage(bookLabel, uploadPageId, file)
      const next: BookImageEntry = {
        imageId: uploaded.imageId,
        pageId: uploadPageId,
        width: uploaded.width,
        height: uploaded.height,
        source: "upload",
      }
      setImages((current) => [next, ...current.filter((candidate) => candidate.imageId !== uploaded.imageId)])
      setSelectedImageId(uploaded.imageId)
      const fallbackAlt = file.name.replace(/\.[^.]+$/u, "").replace(/[-_]+/g, " ").trim() || uploaded.imageId
      if (autoCaptionUpload && apiKey) {
        const generatedAlt = await generateCaptionForImage(uploaded.imageId, uploadPageId)
        setAltDraft(generatedAlt || fallbackAlt)
      } else {
        setAltDraft(fallbackAlt)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-xs font-medium transition-colors ${
          image?.imageId
            ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
        aria-label={image?.imageId ? t`Change image for ${label}` : t`Add image to ${label}`}
        title={image?.imageId ? t`Change image` : t`Add image`}
      >
        {image?.imageId ? (
          <img
            src={quizImageUrl(bookLabel, image.imageId)}
            alt=""
            className="h-5 w-5 rounded object-cover"
          />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{image?.imageId ? t`Image` : t`Add image`}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(760px,94vw)] max-w-[94vw]">
          <DialogTitle>{t`Choose image`}</DialogTitle>
          <DialogDescription>
            {t`Select an image from this book or upload a new one for this activity item.`}
          </DialogDescription>
          <div className="space-y-3">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60">
              {uploading || captioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{captioning ? t`Generating caption...` : uploading ? t`Uploading...` : t`Upload image`}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="sr-only"
                disabled={!uploadPageId || uploading || captioning}
                onChange={(event) => {
                  void uploadImage(event.target.files?.[0])
                  event.currentTarget.value = ""
                }}
              />
            </label>
            <label className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${apiKey ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}>
              <input
                type="checkbox"
                checked={autoCaptionUpload && Boolean(apiKey)}
                disabled={!apiKey || uploading || captioning}
                onChange={(event) => setAutoCaptionUpload(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium">{t`Auto-generate caption after upload`}</span>
                <span className="block text-muted-foreground">
                  {apiKey
                    ? t`Uses the Image Captions prompt and syncs the caption to this page.`
                    : t`Add an API key to generate captions automatically.`}
                </span>
              </span>
            </label>
            {error && <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}
            {captionNotice && <p className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{captionNotice}</p>}
            <div className="max-h-72 overflow-auto rounded-md border">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t`Loading images...`}
                </div>
              ) : images.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                  {t`No book images found`}
                </div>
              ) : (
                <div className="grid gap-2 p-2 sm:grid-cols-3 md:grid-cols-4">
                  {images.map((candidate) => {
                    const selected = candidate.imageId === selectedImageId
                    return (
                      <button
                        key={candidate.imageId}
                        type="button"
                        onClick={() => {
                          setSelectedImageId(candidate.imageId)
                          setAltDraft((current) => current || candidate.caption || candidate.imageId)
                        }}
                        aria-pressed={selected}
                        className={`rounded-md border p-2 text-left transition-colors ${selected ? "border-orange-500 bg-orange-50" : "bg-background hover:bg-muted"}`}
                      >
                        <img
                          src={quizImageUrl(bookLabel, candidate.imageId)}
                          alt=""
                          className="mb-2 h-24 w-full rounded object-contain"
                        />
                        <div className="truncate text-[11px] font-medium">{candidate.imageId}</div>
                        <div className="text-[10px] text-muted-foreground">{candidate.source} - {candidate.pageId}</div>
                        {candidate.caption && (
                          <div className="mt-1 truncate text-[10px] text-emerald-700">{candidate.caption}</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{t`Alt text`}</span>
              <div className="flex gap-2">
                <input
                  value={altDraft}
                  onChange={(event) => setAltDraft(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm"
                  placeholder={t`Describe the image for learners using screen readers`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const pageId = selectedImage?.pageId ?? uploadPageId
                    if (selectedImageId && pageId) void generateCaptionForImage(selectedImageId, pageId)
                  }}
                  disabled={!selectedImageId || !apiKey || uploading || captioning}
                  className="h-9 gap-1 px-3 text-xs"
                  title={apiKey ? t`Generate caption and sync to Image Captions` : t`API key required`}
                >
                  {captioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {captioning ? t`Generating` : t`Generate`}
                </Button>
              </div>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              disabled={!image?.imageId}
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" />
              {t`Remove image`}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t`Cancel`}
              </Button>
              <Button type="button" onClick={attachImage} disabled={!selectedImageId || uploading || captioning}>
                {t`Attach image`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const BUILT_IN_TEMPLATE_STYLES: ActivityTemplateStyle[] = [
  "worksheet_rows",
  "practice_cards",
  "quick_check",
  "guided_steps",
]

const DEFAULT_ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: "worksheet-rows",
    name: "Worksheet rows",
    style: "worksheet_rows",
    generationMode: "template_single_page",
    instructions: "Use a clean worksheet layout with clear rows, simple labels, and restrained spacing.",
  },
  {
    id: "practice-cards",
    name: "Practice cards",
    style: "practice_cards",
    generationMode: "template_single_page",
    instructions: "Use four answer cards with friendly spacing, short standalone choices, and encouraging feedback.",
  },
  {
    id: "quick-check",
    name: "Quick check",
    style: "quick_check",
    generationMode: "template_single_page",
    instructions: "Use a compact review layout for many short questions with minimal decoration.",
  },
  {
    id: "step-by-step",
    name: "Step by step",
    style: "guided_steps",
    generationMode: "template_multi_step",
    instructions: "Use a guided sequence with numbered steps and one clear task per step.",
  },
]

const TEXTBOOK_ACTIVITY_TYPES: QuizActivityType[] = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "fill_in_the_blank",
  "open_ended",
  "drag_and_drop",
  "sorting",
]

function normalizedTemplateStyle(style: ActivityTemplateStyle): ActivityTemplateStyle {
  switch (style) {
    case "clean_workbook":
      return "worksheet_rows"
    case "card_practice":
      return "practice_cards"
    case "compact_review":
      return "quick_check"
    default:
      return style
  }
}

function textbookTemplateStorageKey(bookLabel: string): string {
  return `adt.activityTemplates.${bookLabel}`
}

function loadTextbookSavedTemplates(bookLabel: string): ActivityTemplate[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(textbookTemplateStorageKey(bookLabel))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActivityTemplate[]
    return Array.isArray(parsed) ? parsed.filter((template) => template.name && template.style) : []
  } catch {
    return []
  }
}

function saveTextbookTemplates(bookLabel: string, templates: ActivityTemplate[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(textbookTemplateStorageKey(bookLabel), JSON.stringify(templates))
}

function ActivityTemplatePreview({ style }: { style: ActivityTemplateStyle }) {
  const normalizedStyle = normalizedTemplateStyle(style)

  if (normalizedStyle === "practice_cards") {
    return (
      <div className="grid h-14 grid-cols-2 gap-1.5 rounded bg-sky-50 p-1.5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded border border-sky-200 bg-white shadow-sm" />
        ))}
      </div>
    )
  }

  if (normalizedStyle === "quick_check") {
    return (
      <div className="h-14 rounded border border-slate-200 bg-white p-2">
        <div className="mb-1 h-1.5 w-1/2 rounded bg-slate-300" />
        <div className="space-y-1">
          <div className="h-1 rounded bg-slate-100" />
          <div className="h-1 rounded bg-slate-100" />
          <div className="h-1 w-3/4 rounded bg-slate-100" />
        </div>
      </div>
    )
  }

  if (normalizedStyle === "guided_steps") {
    return (
      <div className="h-14 space-y-1 overflow-hidden rounded bg-violet-50 p-1.5">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex h-3.5 items-center gap-1.5 rounded border border-violet-100 bg-white px-1.5">
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[8px] font-semibold leading-none text-white">
              {step}
            </span>
            <span className="h-1 flex-1 rounded bg-violet-100" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-14 rounded border border-slate-200 bg-white p-2">
      <div className="mb-1.5 h-1.5 w-2/5 rounded bg-slate-300" />
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_3rem] gap-1 rounded border border-slate-100 p-1">
          <span className="h-1 rounded bg-slate-200" />
          <span className="h-1 rounded bg-orange-100" />
        </div>
        <div className="grid grid-cols-[1fr_3rem] gap-1 rounded border border-slate-100 p-1">
          <span className="h-1 rounded bg-slate-200" />
          <span className="h-1 rounded bg-orange-100" />
        </div>
      </div>
    </div>
  )
}

function textbookActivityOverrideKey(activity: Pick<TextbookActivity, "pageId" | "sectionId">): string {
  return `${activity.pageId}_${activity.sectionId}`
}

function activityTypeFromSectionType(sectionType: string): QuizActivityType {
  if (sectionType.includes("multiple_select")) return "multiple_select"
  if (sectionType.includes("true_false")) return "true_false"
  if (sectionType.includes("open_ended")) return "open_ended"
  if (sectionType.includes("fill_in")) return "fill_in_the_blank"
  if (sectionType.includes("matching") || sectionType.includes("drag")) return "drag_and_drop"
  if (sectionType.includes("sorting")) return "sorting"
  return "multiple_choice"
}

function makeDetectedQuestion(activity: TextbookActivity, activityType = activityTypeFromSectionType(activity.sectionType)): QuizQuestion {
  const questionText = activity.textPreview || textbookActivityLabel(activity.sectionType)
  switch (activityType) {
    case "multiple_select":
      return {
        activityType,
        question: questionText,
        options: [
          { text: "Option 1", explanation: "" },
          { text: "Option 2", explanation: "" },
          { text: "Option 3", explanation: "" },
          { text: "Option 4", explanation: "" },
        ],
        answerIndexes: [0, 1],
        reasoning: "Detected textbook activity override.",
      }
    case "true_false":
      return {
        activityType,
        question: "True or false.",
        statements: [{ text: questionText, answer: true }],
        reasoning: "Detected textbook activity override.",
      }
    case "fill_in_the_blank":
      return {
        activityType,
        question: "Fill in the blanks.",
        blanks: [{ prompt: questionText.includes("____") ? questionText : `${questionText} ____`, answer: "" }],
        reasoning: "Detected textbook activity override.",
      }
    case "open_ended":
      return {
        activityType,
        question: questionText,
        sampleAnswer: "",
        guidance: "",
        reasoning: "Detected textbook activity override.",
      }
    case "drag_and_drop":
      return {
        activityType,
        question: "Match the pairs.",
        pairs: [{ item: "Item 1", match: "Match 1" }, { item: "Item 2", match: "Match 2" }],
        reasoning: "Detected textbook activity override.",
      }
    case "sorting":
      return {
        activityType,
        question: "Sort the items.",
        categories: [{ label: "Category 1" }, { label: "Category 2" }],
        sortingItems: [{ item: "Item 1", category: "Category 1" }, { item: "Item 2", category: "Category 2" }],
        reasoning: "Detected textbook activity override.",
      }
    case "multiple_choice":
    default:
      return {
        activityType: "multiple_choice",
        question: questionText,
        options: [
          { text: "Option 1", explanation: "" },
          { text: "Option 2", explanation: "" },
          { text: "Option 3", explanation: "" },
          { text: "Option 4", explanation: "" },
        ],
        answerIndex: 0,
        reasoning: "Detected textbook activity override.",
      }
  }
}

function parsePageRange(
  range: string,
  pageIdsByNumber: Map<number, string>,
  pageIdsByLowerId: Map<string, string>
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const rawPart of range.split(",")) {
    const part = rawPart.trim()
    if (!part) continue
    const directPageId = pageIdsByLowerId.get(part.toLowerCase())
    if (directPageId && !seen.has(directPageId)) {
      ids.push(directPageId)
      seen.add(directPageId)
      continue
    }
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) continue
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    for (let pageNumber = Math.min(start, end); pageNumber <= Math.max(start, end); pageNumber += 1) {
      const pageId = pageIdsByNumber.get(pageNumber)
      if (pageId && !seen.has(pageId)) {
        ids.push(pageId)
        seen.add(pageId)
      }
    }
  }
  return ids
}

function formatPageRange(pageIds: string[], pageNumberById: Map<string, number>): string {
  return pageIds.map((pageId) => pageNumberById.get(pageId)?.toString() ?? pageId).join(", ")
}

function getActivityTypeLabel(activityType: QuizActivityType): string {
  switch (activityType) {
    case "multiple_select":
      return "MCQ Multiple Select"
    case "true_false":
      return "True/False"
    case "fill_in_the_blank":
      return "Fill Blanks"
    case "open_ended":
      return "Open Ended"
    case "drag_and_drop":
      return "Matching Pairs"
    case "sorting":
      return "Sorting"
    case "multiple_choice":
    default:
      return "MCQ"
  }
}

function getTemplateStyleLabel(style: ActivityTemplateStyle): string {
  switch (normalizedTemplateStyle(style)) {
    case "practice_cards":
      return "Practice cards"
    case "quick_check":
      return "Quick check"
    case "guided_steps":
      return "Step by step"
    case "worksheet_rows":
    default:
      return "Worksheet rows"
  }
}

function getGenerationModeLabel(mode: ActivityGenerationMode): string {
  switch (mode) {
    case "template_multi_step":
      return "Multi-step"
    case "ai_generated_layout":
      return "AI layout"
    case "template_single_page":
    default:
      return "Single page"
  }
}

function getTextbookActivityValidationIssues(activity: TextbookActivity): string[] {
  const questions = activity.override?.questions ?? [makeDetectedQuestion(activity)]
  const issues: string[] = []
  for (const question of questions) {
    if (collectQuestionImages(question).some((image) => !quizImageHasAlt(image))) {
      issues.push("Image without alt text")
    }
    if (question.activityType === "multiple_choice") {
      if (question.answerIndex == null) issues.push("Missing correct answer")
      const optionTexts = (question.options ?? []).map((option) => option.text.trim().toLowerCase()).filter(Boolean)
      if (new Set(optionTexts).size !== optionTexts.length) issues.push("Duplicate options")
    }
    if (question.activityType === "multiple_select") {
      if ((question.answerIndexes ?? []).length === 0) issues.push("Missing correct answers")
      const optionTexts = (question.options ?? []).map((option) => option.text.trim().toLowerCase()).filter(Boolean)
      if (new Set(optionTexts).size !== optionTexts.length) issues.push("Duplicate options")
    }
    if (question.activityType === "fill_in_the_blank") {
      if ((question.blanks ?? []).some((blank) => !blank.answer.trim())) issues.push("Blank without answer")
    }
  }
  if (activity.imageCount > 0 && activity.answerCount === 0) issues.push("Image activity has no detected answers")
  return Array.from(new Set(issues))
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, "quiz-generation", "book", true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin" />
  }

  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-black/15 text-black hover:bg-black/25 cursor-pointer transition-colors"
        >
          {t`Discard`}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-orange-800 hover:bg-white/80 cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-white/20 text-white hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground">{t`No versions`}</div>
          )}
        </div>
      )}
    </div>
  )
}

function PageThumb({
  bookLabel,
  pageId,
  onClick,
}: {
  bookLabel: string
  pageId: string
  onClick: () => void
}) {
  const { t } = useLingui()
  const [requestImage, setRequestImage] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (requestImage) return
    if (typeof IntersectionObserver === "undefined") {
      setRequestImage(true)
      return
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequestImage(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [requestImage])

  const { data: imageData, isLoading, isError } = usePageImage(
    bookLabel,
    getRequestedPageId(pageId, requestImage)
  )
  const imageState = getQuizImageRenderState({
    isRequested: requestImage,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setRequestImage(true)}
      onFocus={() => setRequestImage(true)}
      aria-label={t`Open page preview for ${pageId}`}
      className="shrink-0 rounded border border-border bg-muted/40 overflow-hidden hover:ring-2 hover:ring-ring transition-shadow cursor-pointer"
    >
      {imageState === "ready" ? (
        <img
          src={`data:image/png;base64,${imageData!.imageBase64}`}
          alt={t`Page ${pageId}`}
          loading="lazy"
          className="h-44 w-auto block"
        />
      ) : imageState === "error" ? (
        <div className="h-44 w-32 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <span>{t`No image`}</span>
        </div>
      ) : (
        <div className="h-44 w-32 flex items-center justify-center px-2 text-[10px] text-muted-foreground">
          {t`Page ${pageId}`}
        </div>
      )}
    </button>
  )
}

function PageLightbox({
  bookLabel,
  pageId,
  open,
  onOpenChange,
}: {
  bookLabel: string
  pageId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLingui()
  const isRequested = open && !!pageId
  const queryPageId = getRequestedPageId(pageId ?? "", isRequested)
  const { data: imageData, isLoading, isError, refetch } = usePageImage(bookLabel, queryPageId)
  const imageState = getQuizImageRenderState({
    isRequested,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {pageId && (
        <DialogContent className="w-auto max-w-[95vw] overflow-hidden gap-2 p-2 sm:max-w-[90vw] bg-white">
          <DialogTitle className="sr-only">{t`Page preview ${pageId}`}</DialogTitle>
          <DialogDescription className="sr-only">
            {t`Full-size source page preview for the selected quiz.`}
          </DialogDescription>
          <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-md bg-muted/20">
            {imageState === "ready" ? (
              <img
                src={`data:image/png;base64,${imageData!.imageBase64}`}
                alt={t`Page ${pageId}`}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            ) : imageState === "error" ? (
              <div className="flex h-64 w-52 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageOff className="h-5 w-5" />
                <span>{t`Image unavailable`}</span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
                >
                  {t`Retry`}
                </button>
              </div>
            ) : (
              <div className="flex h-64 w-52 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t`Loading image...`}</span>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

function textbookActivityLabel(sectionType: string): string {
  return sectionType
    .replace(/^activity_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

type TextbookActivityEditorDraft = {
  activityType: QuizActivityType
  template: ActivityTemplate
  questions: QuizQuestion[]
  assignedPageIds: string[]
  insertAfterPageId: string
  questionsPerQuiz: string
  replaceExistingForPages: boolean
  pageRange: string
}

function createTextbookActivityDraft(
  activity: TextbookActivity,
  pageNumberById: Map<string, number>
): TextbookActivityEditorDraft {
  const override = activity.override
  const assignedPageIds = override?.assignedPageIds?.length ? override.assignedPageIds : [activity.pageId]
  const template = override?.template ?? DEFAULT_ACTIVITY_TEMPLATES[0]
  const activityType = override?.activityType ?? activityTypeFromSectionType(activity.sectionType)
  return {
    activityType,
    template,
    questions: override?.questions?.length ? override.questions : [makeDetectedQuestion(activity, activityType)],
    assignedPageIds,
    insertAfterPageId: override?.insertAfterPageId ?? activity.pageId,
    questionsPerQuiz: String(override?.questionsPerQuiz ?? Math.max(1, override?.questions?.length ?? 1)),
    replaceExistingForPages: override?.replaceExistingForPages ?? false,
    pageRange: formatPageRange(assignedPageIds, pageNumberById),
  }
}

function TextbookQuestionEditor({
  bookLabel,
  uploadPageId,
  apiKey,
  providerCredentials,
  question,
  onChange,
}: {
  bookLabel: string
  uploadPageId: string
  apiKey: string
  providerCredentials?: StageRunProviderCredentials
  question: QuizQuestion
  onChange: (question: QuizQuestion) => void
}) {
  const { t } = useLingui()

  if (question.activityType === "multiple_choice" || question.activityType === "multiple_select") {
    const isMultipleSelect = question.activityType === "multiple_select"
    const answerIndexes = new Set(question.answerIndexes ?? [])
    return (
      <div className="space-y-2">
        <textarea
          value={question.question}
          onChange={(e) => onChange({ ...question, question: e.target.value })}
          className="w-full rounded border bg-background p-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          aria-label={t`Question text`}
        />
        {(question.options ?? []).map((option, optionIdx) => {
          const selected = isMultipleSelect ? answerIndexes.has(optionIdx) : optionIdx === question.answerIndex
          return (
            <div key={optionIdx} className={`grid gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr] ${selected ? "border-emerald-200 bg-emerald-50" : "bg-muted/30"}`}>
              <button
                type="button"
                onClick={() => {
                  if (!isMultipleSelect) {
                    onChange({ ...question, answerIndex: optionIdx })
                    return
                  }
                  const next = new Set(answerIndexes)
                  if (next.has(optionIdx)) next.delete(optionIdx)
                  else next.add(optionIdx)
                  onChange({ ...question, answerIndexes: Array.from(next).sort((a, b) => a - b) })
                }}
                aria-pressed={selected}
                aria-label={selected ? t`Correct answer` : t`Set option ${String(optionIdx + 1)} as correct answer`}
                className="mt-1 rounded-full p-1 text-emerald-700 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {selected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4 opacity-40" />}
              </button>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <textarea
                    value={option.text}
                    onChange={(e) => {
                      const options = (question.options ?? []).map((candidate, index) =>
                        index === optionIdx ? { ...candidate, text: e.target.value } : candidate
                      )
                      onChange({ ...question, options })
                    }}
                    className="w-full resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={1}
                    aria-label={t`Option ${String(optionIdx + 1)}`}
                  />
                  <QuizImageButton
                    bookLabel={bookLabel}
                    uploadPageId={uploadPageId}
                    apiKey={apiKey}
                    providerCredentials={providerCredentials}
                    image={option.image}
                    label={t`Option ${String(optionIdx + 1)}`}
                    onChange={(image) => {
                      const options = (question.options ?? []).map((candidate, index) =>
                        index === optionIdx ? { ...candidate, image } : candidate
                      )
                      onChange({ ...question, options })
                    }}
                  />
                </div>
                <textarea
                  value={option.explanation}
                  onChange={(e) => {
                    const options = (question.options ?? []).map((candidate, index) =>
                      index === optionIdx ? { ...candidate, explanation: e.target.value } : candidate
                    )
                    onChange({ ...question, options })
                  }}
                  className="w-full resize-none rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={1}
                  placeholder={t`Explanation`}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (question.activityType === "true_false") {
    const statements = question.statements?.length ? question.statements : [{ text: "", answer: true }]
    return (
      <div className="space-y-2">
        <textarea
          value={question.question}
          onChange={(e) => onChange({ ...question, question: e.target.value })}
          className="w-full rounded border bg-background p-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          rows={1}
          aria-label={t`Question title`}
        />
        {statements.map((statement, statementIdx) => (
          <div key={statementIdx} className="space-y-2 rounded-md border bg-muted/30 p-2">
            <textarea
              value={statement.text}
              onChange={(e) => {
                const next = statements.map((candidate, index) =>
                  index === statementIdx ? { ...candidate, text: e.target.value } : candidate
                )
                onChange({ ...question, statements: next })
              }}
              className="w-full rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              aria-label={t`Statement`}
            />
            <div className="inline-flex overflow-hidden rounded border bg-background p-0.5">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => {
                    const next = statements.map((candidate, index) =>
                      index === statementIdx ? { ...candidate, answer: value } : candidate
                    )
                    onChange({ ...question, statements: next })
                  }}
                  className={`h-7 px-3 text-xs font-medium ${statement.answer === value ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {value ? t`True` : t`False`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (question.activityType === "fill_in_the_blank") {
    return (
      <div className="space-y-2">
        {(question.blanks ?? []).map((blank, blankIdx) => (
          <div key={blankIdx} className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <textarea
              value={blank.prompt}
              onChange={(e) => {
                const blanks = (question.blanks ?? []).map((candidate, index) =>
                  index === blankIdx ? { ...candidate, prompt: e.target.value } : candidate
                )
                onChange({ ...question, blanks })
              }}
              className="rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              aria-label={t`Blank prompt`}
            />
            <input
              value={blank.answer}
              onChange={(e) => {
                const blanks = (question.blanks ?? []).map((candidate, index) =>
                  index === blankIdx ? { ...candidate, answer: e.target.value } : candidate
                )
                onChange({ ...question, blanks })
              }}
              className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t`Blank answer`}
            />
          </div>
        ))}
      </div>
    )
  }

  if (question.activityType === "open_ended") {
    return (
      <div className="space-y-2">
        <textarea
          value={question.question}
          onChange={(e) => onChange({ ...question, question: e.target.value })}
          className="w-full rounded border bg-background p-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          aria-label={t`Open ended prompt`}
        />
        <textarea
          value={question.sampleAnswer ?? ""}
          onChange={(e) => onChange({ ...question, sampleAnswer: e.target.value })}
          className="w-full rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          placeholder={t`Sample answer`}
          aria-label={t`Sample answer`}
        />
        <textarea
          value={question.guidance ?? ""}
          onChange={(e) => onChange({ ...question, guidance: e.target.value })}
          className="w-full rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          placeholder={t`Guidance`}
          aria-label={t`Guidance`}
        />
      </div>
    )
  }

  if (question.activityType === "sorting") {
    const categories = question.categories?.length ? question.categories : [{ label: "Category 1" }, { label: "Category 2" }]
    const sortingItems = question.sortingItems ?? []
    return (
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category, categoryIdx) => (
            <input
              key={categoryIdx}
              value={category.label}
              onChange={(e) => {
                const previous = category.label
                const nextLabel = e.target.value
                onChange({
                  ...question,
                  categories: categories.map((candidate, index) =>
                    index === categoryIdx ? { ...candidate, label: nextLabel } : candidate
                  ),
                  sortingItems: sortingItems.map((item) =>
                    item.category === previous ? { ...item, category: nextLabel } : item
                  ),
                })
              }}
              className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t`Category ${String(categoryIdx + 1)}`}
            />
          ))}
        </div>
        {sortingItems.map((item, itemIdx) => (
          <div key={itemIdx} className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <div className="flex items-start gap-2">
              <input
                value={item.item}
                onChange={(e) => {
                  onChange({
                    ...question,
                    sortingItems: sortingItems.map((candidate, index) =>
                      index === itemIdx ? { ...candidate, item: e.target.value } : candidate
                    ),
                  })
                }}
                className="h-9 min-w-0 flex-1 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={t`Sorting item`}
              />
              <QuizImageButton
                bookLabel={bookLabel}
                uploadPageId={uploadPageId}
                apiKey={apiKey}
                providerCredentials={providerCredentials}
                image={item.image}
                label={t`Sorting item ${String(itemIdx + 1)}`}
                onChange={(image) => {
                  onChange({
                    ...question,
                    sortingItems: sortingItems.map((candidate, index) =>
                      index === itemIdx ? { ...candidate, image } : candidate
                    ),
                  })
                }}
              />
            </div>
            <select
              value={item.category}
              onChange={(e) => {
                onChange({
                  ...question,
                  sortingItems: sortingItems.map((candidate, index) =>
                    index === itemIdx ? { ...candidate, category: e.target.value } : candidate
                  ),
                })
              }}
              className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t`Sorting category`}
            >
              {categories.map((category, categoryIdx) => (
                <option key={categoryIdx} value={category.label}>{category.label || t`Category ${String(categoryIdx + 1)}`}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {(question.pairs ?? []).map((pair, pairIdx) => (
        <div key={pairIdx} className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <input
              value={pair.item}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((candidate, index) =>
                  index === pairIdx ? { ...candidate, item: e.target.value } : candidate
                )
                onChange({ ...question, pairs })
              }}
              className="h-9 min-w-0 flex-1 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t`Match item`}
            />
            <QuizImageButton
              bookLabel={bookLabel}
              uploadPageId={uploadPageId}
              apiKey={apiKey}
              providerCredentials={providerCredentials}
              image={pair.itemImage}
              label={t`Match item ${String(pairIdx + 1)}`}
              onChange={(image) => {
                const pairs = (question.pairs ?? []).map((candidate, index) =>
                  index === pairIdx ? { ...candidate, itemImage: image } : candidate
                )
                onChange({ ...question, pairs })
              }}
            />
          </div>
          <div className="flex items-start gap-2">
            <input
              value={pair.match}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((candidate, index) =>
                  index === pairIdx ? { ...candidate, match: e.target.value } : candidate
                )
                onChange({ ...question, pairs })
              }}
              className="h-9 min-w-0 flex-1 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t`Match answer`}
            />
            <QuizImageButton
              bookLabel={bookLabel}
              uploadPageId={uploadPageId}
              apiKey={apiKey}
              providerCredentials={providerCredentials}
              image={pair.matchImage}
              label={t`Match answer ${String(pairIdx + 1)}`}
              onChange={(image) => {
                const pairs = (question.pairs ?? []).map((candidate, index) =>
                  index === pairIdx ? { ...candidate, matchImage: image } : candidate
                )
                onChange({ ...question, pairs })
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

type TextbookPageOption = {
  pageId: string
  pageNumber: number
}

function TextbookActivitiesPanel({
  bookLabel,
  pages,
  apiKey,
  providerCredentials,
  onOpenInStoryboard,
}: {
  bookLabel: string
  pages: TextbookPageOption[]
  apiKey: string
  providerCredentials?: StageRunProviderCredentials
  onOpenInStoryboard: (activity: TextbookActivity) => void
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useTextbookActivities(bookLabel)
  const quizzesQuery = useQuizzes(bookLabel)
  const [tryActivity, setTryActivity] = useState<TextbookActivity | null>(null)
  const [editingActivityKey, setEditingActivityKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<TextbookActivityEditorDraft | null>(null)
  const [savingActivityKey, setSavingActivityKey] = useState<string | null>(null)
  const [saveErrorByKey, setSaveErrorByKey] = useState<Record<string, string>>({})
  const [savedTemplates, setSavedTemplates] = useState<ActivityTemplate[]>(() => loadTextbookSavedTemplates(bookLabel))
  const [templateNotice, setTemplateNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<QuizActivityType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "detected" | "customized" | "synced" | "weak">("all")
  const activities = data?.activities ?? []
  const pageIdsByNumber = useMemo(() => new Map(pages.map((page) => [page.pageNumber, page.pageId])), [pages])
  const pageIdsByLowerId = useMemo(() => new Map(pages.map((page) => [page.pageId.toLowerCase(), page.pageId])), [pages])
  const pageNumberById = useMemo(() => new Map(pages.map((page) => [page.pageId, page.pageNumber])), [pages])
  const allTemplates = useMemo(() => [...DEFAULT_ACTIVITY_TEMPLATES, ...savedTemplates], [savedTemplates])
  const overrideQuizPreviewIdByActivityKey = useMemo(() => {
    const previewIds = new Map<string, string>()
    const visibleQuizzes = (quizzesQuery.data?.quizzes?.quizzes ?? []).filter((quiz) => !quiz.isPruned)
    visibleQuizzes.forEach((quiz, index) => {
      if (quiz.sourceTextbookActivityId) {
        previewIds.set(quiz.sourceTextbookActivityId, `qz${pad3(index + 1)}`)
      }
    })
    return previewIds
  }, [quizzesQuery.data])
  const syncedOverrideIds = useMemo(
    () => new Set(overrideQuizPreviewIdByActivityKey.keys()),
    [overrideQuizPreviewIdByActivityKey]
  )
  const typeCounts = useMemo(() => {
    const counts = new Map<QuizActivityType, number>()
    for (const activity of activities) {
      const type = activity.override?.activityType ?? activityTypeFromSectionType(activity.sectionType)
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return counts
  }, [activities])
  const displayActivities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activities
      .filter((activity) => {
        const activityType = activity.override?.activityType ?? activityTypeFromSectionType(activity.sectionType)
        if (typeFilter !== "all" && activityType !== typeFilter) return false
        if (query) {
          const haystack = [
            activity.textPreview,
            activity.sectionId,
            textbookActivityLabel(activity.sectionType),
            activity.override?.questions.map((question) => question.question).join(" "),
          ].filter(Boolean).join(" ").toLowerCase()
          if (!haystack.includes(query)) return false
        }
        if (statusFilter === "customized" && !activity.override) return false
        if (statusFilter === "detected" && activity.override) return false
        if (statusFilter === "synced" && !syncedOverrideIds.has(textbookActivityOverrideKey(activity))) return false
        if (statusFilter === "weak" && !(activity.answerCount === 0 || !activity.hasRendering)) return false
        return true
      })
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber || a.sectionIndex - b.sectionIndex)
  }, [activities, search, statusFilter, syncedOverrideIds, typeFilter])

  useEffect(() => {
    setSavedTemplates(loadTextbookSavedTemplates(bookLabel))
  }, [bookLabel])

  const activityTypeLabel = (activityType: QuizActivityType) => {
    switch (activityType) {
      case "multiple_select":
        return t`MCQ Multiple Select`
      case "true_false":
        return t`True/False`
      case "fill_in_the_blank":
        return t`Fill Blanks`
      case "open_ended":
        return t`Open Ended`
      case "drag_and_drop":
        return t`Matching Pairs`
      case "sorting":
        return t`Sorting`
      case "multiple_choice":
      default:
        return t`MCQ`
    }
  }

  const openEditor = (activity: TextbookActivity) => {
    const key = textbookActivityOverrideKey(activity)
    setEditingActivityKey(key)
    setDraft(createTextbookActivityDraft(activity, pageNumberById))
    setTemplateNotice(null)
    setSaveErrorByKey((current) => ({ ...current, [key]: "" }))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("adt.telemetry", {
        detail: { event: "textbook_activity.edit_opened", activityId: key },
      }))
    }
  }

  const invalidateActivityQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes", "textbook-activities"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages"] }),
      queryClient.invalidateQueries({ queryKey: ["storyboard", bookLabel] }),
    ])
  }

  const saveDraft = async (activity: TextbookActivity) => {
    if (!draft) return
    const key = textbookActivityOverrideKey(activity)
    const assignedPageIds = draft.assignedPageIds.length ? draft.assignedPageIds : [activity.pageId]
    const payload: TextbookActivityOverrideInput = {
      sourcePageId: activity.pageId,
      sourceSectionId: activity.sectionId,
      activityType: draft.activityType,
      template: {
        ...draft.template,
        name: draft.template.name.trim() || t`Untitled template`,
        style: normalizedTemplateStyle(draft.template.style),
        instructions: draft.template.instructions?.trim() || undefined,
      },
      questions: draft.questions.length ? draft.questions : [makeDetectedQuestion(activity, draft.activityType)],
      assignedPageIds,
      insertAfterPageId: draft.insertAfterPageId || assignedPageIds[0] || activity.pageId,
      questionsPerQuiz: Math.min(20, Math.max(1, Number.parseInt(draft.questionsPerQuiz, 10) || draft.questions.length || 1)),
      replaceExistingForPages: draft.replaceExistingForPages,
      hidden: false,
    }
    setSavingActivityKey(key)
    setSaveErrorByKey((current) => ({ ...current, [key]: "" }))
    try {
      const result = await api.saveTextbookActivityOverride(bookLabel, key, payload)
      if (result.override) {
        queryClient.setQueryData<{ activities: TextbookActivity[] }>(
          ["books", bookLabel, "quizzes", "textbook-activities"],
          (current) => current
            ? {
                activities: current.activities.map((candidate) =>
                  textbookActivityOverrideKey(candidate) === key
                    ? { ...candidate, override: result.override ?? undefined }
                    : candidate
                ),
              }
            : current
        )
      }
      setEditingActivityKey(null)
      setDraft(null)
      void invalidateActivityQueries().catch(() => undefined)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("adt.telemetry", {
          detail: { event: "textbook_activity.saved", activityId: key, pageCount: assignedPageIds.length },
        }))
      }
    } catch (err) {
      setSaveErrorByKey((current) => ({
        ...current,
        [key]: err instanceof Error ? err.message : String(err),
      }))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("adt.telemetry", {
          detail: { event: "sync.failed", activityId: key },
        }))
      }
    } finally {
      setSavingActivityKey(null)
    }
  }

  const resetToDetected = async (activity: TextbookActivity) => {
    const key = textbookActivityOverrideKey(activity)
    const detectedActivity = { ...activity, override: undefined }
    if (!activity.override) {
      setDraft(createTextbookActivityDraft(detectedActivity, pageNumberById))
      return
    }
    setSavingActivityKey(key)
    setSaveErrorByKey((current) => ({ ...current, [key]: "" }))
    try {
      await api.deleteTextbookActivityOverride(bookLabel, key)
      queryClient.setQueryData<{ activities: TextbookActivity[] }>(
        ["books", bookLabel, "quizzes", "textbook-activities"],
        (current) => current
          ? {
              activities: current.activities.map((candidate) => {
                if (textbookActivityOverrideKey(candidate) !== key) return candidate
                const { override: _override, ...detected } = candidate
                return detected
              }),
            }
          : current
      )
      queryClient.setQueryData<{ quizzes: QuizGenerationOutput | null; version: number | null }>(
        ["books", bookLabel, "quizzes"],
        (current) => {
          if (!current?.quizzes) return current
          const retained = current.quizzes.quizzes
            .filter((quiz) => quiz.sourceTextbookActivityId !== key)
            .map((quiz, index) => ({ ...quiz, quizIndex: index }))
          return {
            ...current,
            quizzes: {
              ...current.quizzes,
              quizzes: retained,
            },
          }
        }
      )
      setEditingActivityKey(null)
      setDraft(null)
      setTryActivity((current) => current && textbookActivityOverrideKey(current) === key ? detectedActivity : current)
      void invalidateActivityQueries().catch(() => undefined)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("adt.telemetry", {
          detail: { event: "textbook_activity.reset_to_detected", activityId: key },
        }))
      }
    } catch (err) {
      setSaveErrorByKey((current) => ({
        ...current,
        [key]: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setSavingActivityKey(null)
    }
  }

  const selectTemplate = (template: ActivityTemplate) => {
    setTemplateNotice(null)
    setDraft((current) => current ? {
      ...current,
      template: {
        ...template,
        style: normalizedTemplateStyle(template.style),
      },
    } : current)
  }

  const saveReusableTemplate = () => {
    if (!draft) return
    const template: ActivityTemplate = {
      ...draft.template,
      id: draft.template.id ?? `textbook-${Date.now()}`,
      name: draft.template.name.trim() || t`Untitled template`,
      style: normalizedTemplateStyle(draft.template.style),
      instructions: draft.template.instructions?.trim() || undefined,
    }
    const next = [
      ...savedTemplates.filter((candidate) => candidate.id !== template.id),
      template,
    ]
    setSavedTemplates(next)
    saveTextbookTemplates(bookLabel, next)
    setTemplateNotice(t`Saved`)
  }

  const applyDraftRange = () => {
    if (!draft) return
    const pageIds = parsePageRange(draft.pageRange, pageIdsByNumber, pageIdsByLowerId)
    if (pageIds.length === 0) return
    setDraft({
      ...draft,
      assignedPageIds: pageIds,
      insertAfterPageId: pageIds.includes(draft.insertAfterPageId) ? draft.insertAfterPageId : pageIds[0],
      pageRange: formatPageRange(pageIds, pageNumberById),
    })
  }

  const updateDraftQuestion = (questionIndex: number, question: QuizQuestion) => {
    setDraft((current) => current ? {
      ...current,
      questions: current.questions.map((candidate, index) => index === questionIndex ? question : candidate),
    } : current)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">{t`Loading textbook activities...`}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof Error ? error.message : t`Failed to load textbook activities.`}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border bg-card py-16 text-muted-foreground">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
          <FileQuestion className="h-6 w-6 text-orange-300" />
        </div>
        <p className="text-sm font-medium">
          {t`No textbook activities detected`}
        </p>
        <p className="mt-1 text-xs">
          {t`Run the Activity Converter to turn textbook activities into editable interactive sections.`}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-md border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t`Textbook Activities`}</h2>
              <p className="text-xs text-muted-foreground">
                {t`${String(displayActivities.length)} of ${String(activities.length)} detected activities`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t`Search activities`}
                className="h-8 w-52 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={t`Search textbook activities`}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label={t`Filter activity status`}
              >
                <option value="all">{t`All statuses`}</option>
                <option value="detected">{t`Detected`}</option>
                <option value="customized">{t`Customized`}</option>
                <option value="synced">{t`Synced`}</option>
                <option value="weak">{t`Needs review`}</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              aria-pressed={typeFilter === "all"}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${typeFilter === "all" ? "border-orange-500 bg-orange-50 text-orange-800" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              {t`All`} ({activities.length})
            </button>
            {TEXTBOOK_ACTIVITY_TYPES.map((activityType) => (
              <button
                key={activityType}
                type="button"
                onClick={() => setTypeFilter(activityType)}
                aria-pressed={typeFilter === activityType}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${typeFilter === activityType ? "border-orange-500 bg-orange-50 text-orange-800" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {activityTypeLabel(activityType)} ({typeCounts.get(activityType) ?? 0})
              </button>
            ))}
          </div>
        </div>

        {displayActivities.map((activity) => {
          const key = textbookActivityOverrideKey(activity)
          const isEditing = editingActivityKey === key
          const issues = getTextbookActivityValidationIssues(activity)
          const activityType = activity.override?.activityType ?? activityTypeFromSectionType(activity.sectionType)
          const detectedLabel = textbookActivityLabel(activity.sectionType)
          const displayTitle = activity.override ? activityTypeLabel(activityType) : detectedLabel
          const assignedPageIds = activity.override?.assignedPageIds?.length ? activity.override.assignedPageIds : [activity.pageId]
          const previewPageId = overrideQuizPreviewIdByActivityKey.get(key)
          const canTryActivity = activity.hasRendering || Boolean(previewPageId)
          const assignedLabel = assignedPageIds
            .slice(0, 4)
            .map((pageId) => {
              const pageNumber = pageNumberById.get(pageId) ?? Number(pageId.replace(/\D/g, ""))
              return pageNumber > 0 ? `pg${pad3(pageNumber)}` : pageId
            })
            .join(", ")
          const isSynced = syncedOverrideIds.has(key)
          const saveError = saveErrorByKey[key]
          const saveBusy = savingActivityKey === key
          return (
          <div key={key} className="overflow-hidden rounded-md border bg-card">
            <div className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                <FileQuestion className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{displayTitle}</h3>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${activityBadgeClass(activityType)}`}>
                    {activityTypeLabel(activityType)}
                  </span>
                  {activity.override && (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      {t`Customized`}
                    </span>
                  )}
                  {activity.override && detectedLabel !== displayTitle && (
                    <span className="rounded border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t`Detected as ${detectedLabel}`}
                    </span>
                  )}
                  {!activity.hasRendering && (
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {t`Needs rendering`}
                    </span>
                  )}
                  {issues.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openEditor(activity)}
                      className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
                      title={issues.join(", ")}
                    >
                      {t`Fix`} {issues.length}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t`Page ${String(activity.pageNumber)}`} - {activity.sectionId} -{" "}
                  {t`${String(activity.textBlockCount)} text blocks`} -{" "}
                  {t`${String(activity.imageCount)} images`} -{" "}
                  {t`${String(activity.answerCount)} answers`}
                </p>
                {activity.textPreview && (
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                    {activity.textPreview}
                  </p>
                )}
                {activity.override && (
                  <button
                    type="button"
                    onClick={() => onOpenInStoryboard(activity)}
                    className={`mt-2 text-xs font-medium ${isSynced ? "text-emerald-700 hover:text-emerald-800" : "text-amber-700 hover:text-amber-800"}`}
                  >
                    {isSynced
                      ? t`Synced to ${assignedLabel} ✓`
                      : t`Sync pending for ${assignedLabel}`}
                  </button>
                )}
                {saveError && !isEditing && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-700">
                    <span>{saveError}</span>
                    <button type="button" onClick={() => openEditor(activity)} className="font-medium underline">
                      {t`Retry sync`}
                    </button>
                  </div>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTryActivity(activity)}
                  disabled={!canTryActivity}
                  className="h-8 gap-1 px-2.5 text-xs"
                  title={
                    previewPageId
                      ? t`Try customized activity`
                      : activity.hasRendering
                        ? t`Try activity`
                        : t`Render this activity before previewing it`
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t`Try`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditor(activity)}
                  className="h-8 gap-1 px-2.5 text-xs"
                  aria-label={t`Edit textbook activity`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t`Edit`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenInStoryboard(activity)}
                  className="h-8 gap-1 px-2.5 text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {t`Open in Storyboard`}
                </Button>
              </div>
            </div>

            {isEditing && draft && (
              <div
                className="border-t bg-muted/20 px-4 py-4"
                role="region"
                aria-label={t`Textbook activity editor`}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(180px,240px)_1fr]">
                      <label className="space-y-1">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">{t`Activity type`}</span>
                        <select
                          value={draft.activityType}
                          onChange={(e) => {
                            const activityType = e.target.value as QuizActivityType
                            setDraft({
                              ...draft,
                              activityType,
                              questions: [makeDetectedQuestion(activity, activityType)],
                            })
                          }}
                          className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
                          aria-label={t`Activity type`}
                        >
                          {TEXTBOOK_ACTIVITY_TYPES.map((activityType) => (
                            <option key={activityType} value={activityType}>{activityTypeLabel(activityType)}</option>
                          ))}
                        </select>
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">{t`Layout picker`}</span>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {DEFAULT_ACTIVITY_TEMPLATES.map((template) => {
                            const selected = normalizedTemplateStyle(draft.template.style) === template.style
                            return (
                              <button
                                key={template.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => selectTemplate(template)}
                                className={`rounded-md border p-2 text-left transition-colors ${selected ? "border-orange-500 bg-orange-50" : "bg-background hover:bg-muted"}`}
                              >
                                <span className="text-xs font-semibold">{t`${template.name}`}</span>
                                <ActivityTemplatePreview style={template.style} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <details className="rounded-md border bg-background px-3 py-2" open>
                      <summary className="cursor-pointer text-xs font-medium">{t`Customize selected layout`}</summary>
                      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(150px,1fr)_150px_140px_auto]">
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{t`Template name`}</span>
                          <input
                            value={draft.template.name}
                            onChange={(e) => {
                              setTemplateNotice(null)
                              setDraft({ ...draft, template: { ...draft.template, name: e.target.value } })
                            }}
                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                            aria-label={t`Template name`}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{t`Layout`}</span>
                          <select
                            value={normalizedTemplateStyle(draft.template.style)}
                            onChange={(e) => setDraft({ ...draft, template: { ...draft.template, style: e.target.value as ActivityTemplateStyle } })}
                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                          >
                            {BUILT_IN_TEMPLATE_STYLES.map((style) => (
                              <option key={style} value={style}>{t`${getTemplateStyleLabel(style)}`}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{t`Length`}</span>
                          <select
                            value={draft.template.generationMode}
                            onChange={(e) => setDraft({ ...draft, template: { ...draft.template, generationMode: e.target.value as ActivityGenerationMode } })}
                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                          >
                            {(["template_single_page", "template_multi_step"] as ActivityGenerationMode[]).map((mode) => (
                              <option key={mode} value={mode}>{t`${getGenerationModeLabel(mode)}`}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={saveReusableTemplate} className="h-8 text-xs">
                            {t`Save as reusable style`}
                          </Button>
                          {templateNotice && <span className="pb-2 text-[10px] font-medium text-emerald-700">{templateNotice}</span>}
                        </div>
                        {allTemplates.length > DEFAULT_ACTIVITY_TEMPLATES.length && (
                          <label className="space-y-1 lg:col-span-2">
                            <span className="text-[10px] font-medium text-muted-foreground">{t`Reusable styles`}</span>
                            <select
                              value=""
                              onChange={(e) => {
                                const template = allTemplates.find((candidate) => (candidate.id ?? candidate.name) === e.target.value)
                                if (template) selectTemplate(template)
                              }}
                              className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                            >
                              <option value="">{t`Choose saved style`}</option>
                              {savedTemplates.map((template) => (
                                <option key={template.id ?? template.name} value={template.id ?? template.name}>{template.name}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <textarea
                          value={draft.template.instructions ?? ""}
                          onChange={(e) => setDraft({ ...draft, template: { ...draft.template, instructions: e.target.value } })}
                          aria-label={t`Template instructions`}
                          placeholder={t`Example: keep answers short, make it a four-option card activity, or turn the worksheet into a guided sequence.`}
                          className="min-h-16 resize-y rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring lg:col-span-4"
                        />
                      </div>
                    </details>

                    <div className="rounded-md border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold">{t`Per-question editor`}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDraft({ ...draft, questions: [...draft.questions, makeDetectedQuestion(activity, draft.activityType)] })}
                          className="h-7 text-xs"
                        >
                          {t`Add question`}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {draft.questions.map((question, questionIndex) => (
                          <div key={questionIndex} className="rounded-md border bg-muted/20 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold">{t`Question ${String(questionIndex + 1)}`}</span>
                              {draft.questions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, index) => index !== questionIndex) })}
                                  className="text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                  {t`Remove`}
                                </button>
                              )}
                            </div>
                            <TextbookQuestionEditor
                              bookLabel={bookLabel}
                              uploadPageId={draft.assignedPageIds[0] ?? activity.pageId}
                              apiKey={apiKey}
                              providerCredentials={providerCredentials}
                              question={question}
                              onChange={(nextQuestion) => updateDraftQuestion(questionIndex, nextQuestion)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-md border bg-background p-3">
                      <h4 className="mb-2 text-xs font-semibold">{t`Page assignment`}</h4>
                      <div className="grid gap-2">
                        <div className="flex gap-2">
                          <input
                            value={draft.pageRange}
                            onChange={(e) => setDraft({ ...draft, pageRange: e.target.value })}
                            placeholder={t`1-12, 20, pg045`}
                            className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label={t`Page range`}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={applyDraftRange} className="h-8 text-xs">
                            {t`Apply range`}
                          </Button>
                        </div>
                        <div className="grid max-h-36 grid-cols-5 gap-1 overflow-auto rounded border bg-muted/20 p-2">
                          {pages.map((page) => {
                            const selected = draft.assignedPageIds.includes(page.pageId)
                            return (
                              <button
                                key={page.pageId}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  const nextPageIds = selected
                                    ? draft.assignedPageIds.filter((pageId) => pageId !== page.pageId)
                                    : [...draft.assignedPageIds, page.pageId]
                                  setDraft({
                                    ...draft,
                                    assignedPageIds: nextPageIds,
                                    pageRange: formatPageRange(nextPageIds, pageNumberById),
                                  })
                                }}
                                className={`h-7 rounded border text-[10px] font-medium ${selected ? "border-orange-500 bg-orange-50 text-orange-800" : "bg-background text-muted-foreground hover:bg-muted"}`}
                              >
                                {page.pageNumber}
                              </button>
                            )
                          })}
                        </div>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{t`Insert after`}</span>
                          <select
                            value={draft.insertAfterPageId}
                            onChange={(e) => setDraft({ ...draft, insertAfterPageId: e.target.value })}
                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                            aria-label={t`Insert after page`}
                          >
                            {pages.map((page) => (
                              <option key={page.pageId} value={page.pageId}>
                                {t`Page ${String(page.pageNumber)}`} ({page.pageId})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{t`Questions/quiz`}</span>
                          <input
                            value={draft.questionsPerQuiz}
                            onChange={(e) => setDraft({ ...draft, questionsPerQuiz: e.target.value })}
                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                            inputMode="numeric"
                            aria-label={t`Questions per quiz`}
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-2 text-xs">
                          <input
                            type="checkbox"
                            checked={draft.replaceExistingForPages}
                            onChange={(e) => setDraft({ ...draft, replaceExistingForPages: e.target.checked })}
                          />
                          {t`Replace existing activities for selected pages`}
                        </label>
                      </div>
                    </div>

                    {saveError && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <p>{saveError}</p>
                        <button type="button" onClick={() => void saveDraft(activity)} className="mt-1 font-medium underline">
                          {t`Retry sync`}
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void resetToDetected(activity)}
                        disabled={saveBusy}
                        className="gap-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t`Reset to detected`}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingActivityKey(null)
                          setDraft(null)
                        }}
                        disabled={saveBusy}
                      >
                        {t`Cancel`}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveDraft(activity)}
                        disabled={saveBusy || draft.assignedPageIds.length === 0}
                        className="gap-1"
                      >
                        {saveBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {t`Save`}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )
        })}

        {displayActivities.length === 0 && activities.length > 0 && (
          <div>
            <div className="rounded-md border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {t`No textbook activities match these filters.`}
            </div>
          </div>
        )}
      </div>

      <Dialog open={tryActivity != null} onOpenChange={(open) => { if (!open) setTryActivity(null) }}>
        <DialogContent className="h-[85vh] w-[min(1100px,96vw)] max-w-[96vw] gap-0 overflow-hidden p-0 bg-white">
          <DialogTitle className="sr-only">{t`Try textbook activity`}</DialogTitle>
          <DialogDescription className="sr-only">{t`Interactive preview for the selected textbook activity.`}</DialogDescription>
          <div className="flex h-11 items-center border-b px-3 pr-12">
            <span className="text-xs font-medium text-muted-foreground">
              {tryActivity
                ? tryActivity.override
                  ? activityTypeLabel(tryActivity.override.activityType)
                  : textbookActivityLabel(tryActivity.sectionType)
                : t`Try`}
            </span>
          </div>
          {tryActivity && (() => {
            const previewPageId = overrideQuizPreviewIdByActivityKey.get(textbookActivityOverrideKey(tryActivity))
            const previewId = previewPageId ?? tryActivity.sectionId
            return (
            <iframe
              title={t`Textbook activity preview`}
              className="h-[calc(85vh-44px)] w-full bg-white"
              src={`/api/books/${bookLabel}/adt-preview/${previewId}.html?embed=1`}
            />
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function QuizzesView({ bookLabel, selectedPageId }: { bookLabel: string; selectedPageId?: string }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuizzes(bookLabel)
  const pagesQuery = usePages(bookLabel)
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { setExtra } = useStepHeader()
  const { setSectionIndex, skipNextResetRef } = useSectionNav()
  const {
    apiKey,
    hasApiKey,
    anthropicKey,
    googleKey,
    customBaseUrl,
    customApiKey,
    azureKey,
    azureRegion,
    geminiKey,
  } = useApiKey()
  const providerCredentials: StageRunProviderCredentials = {
    anthropicApiKey: anthropicKey || undefined,
    googleApiKey: googleKey || undefined,
    customBaseUrl: customBaseUrl || undefined,
    customApiKey: customApiKey || undefined,
    azure: { key: azureKey, region: azureRegion },
    geminiApiKey: geminiKey || undefined,
  }
  const pages = pagesQuery.data ?? []
  const layoutType = typeof bookConfigData?.config?.layout_type === "string"
    ? bookConfigData.config.layout_type
    : undefined
  const canUseTextbookActivities = layoutType === "textbook"

  const getActivityLabel = (activityType: QuizActivityType) => {
    switch (activityType) {
      case "multiple_select":
        return t`MCQ Multiple Select`
      case "true_false":
        return t`True/False`
      case "fill_in_the_blank":
        return t`Fill in the blanks`
      case "open_ended":
        return t`Open Ended`
      case "drag_and_drop":
        return t`Matching Pairs`
      case "sorting":
        return t`Sorting`
      case "multiple_choice":
      default:
        return t`Multiple choice`
    }
  }

  const getPlacementLabel = (pageId: string) => {
    const page = pages.find((candidate) => candidate.pageId === pageId)
    return page ? t`After page ${String(page.pageNumber)}` : t`After ${pageId}`
  }

  const [pending, setPending] = useState<QuizData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lightboxPageId, setLightboxPageId] = useState<string | null>(null)
  const [tryQuizIndex, setTryQuizIndex] = useState<number | null>(null)
  const [sourceMode, setSourceMode] = useState<QuizSourceMode>("ai")

  // Reset pending when data changes
  useEffect(() => {
    setPending(null)
  }, [data?.version])

  useEffect(() => {
    if (!canUseTextbookActivities && sourceMode === "textbook") {
      setSourceMode("ai")
    }
  }, [sourceMode, canUseTextbookActivities])

  const effective = pending ?? data?.quizzes
  const quizzes = effective?.quizzes ?? []
  const dirty = pending != null

  const displayQuizzes = selectedPageId
    ? quizzes.filter((q) => q.pageIds.includes(selectedPageId))
    : quizzes
  const displayQuestionCount = displayQuizzes.reduce(
    (count, quiz) => count + getQuizQuestions(quiz).length,
    0
  )

  const saveQuizzes = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    setSaveError(null)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      await api.updateQuizzes(bookLabel, pending)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      setPending(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      await minDelay
      setSaving(false)
    }
  }, [pending, bookLabel, queryClient])

  const saveRef = useRef(saveQuizzes)
  saveRef.current = saveQuizzes

  useEffect(() => {
    if (!data?.quizzes) return
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(displayQuestionCount)} questions`}</span>
        <VersionPicker
          currentVersion={data.version}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          onPreview={(d) => setPending(d as QuizData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>
    )
    return () => setExtra(null)
  }, [data, displayQuestionCount, saving, dirty, bookLabel, selectedPageId])

  const updateQuizQuestions = (
    quizIdx: number,
    updater: (questions: QuizQuestion[]) => QuizQuestion[]
  ) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((quiz, i) => {
        if (i !== quizIdx) return quiz
        return syncQuizFromQuestions(quiz, updater(getQuizQuestions(quiz)))
      }),
    })
  }

  const updateSharedTitle = (quizIdx: number, title: string) => {
    updateQuizQuestions(quizIdx, (questions) => questions.map((q) => ({ ...q, question: title })))
  }

  const updateQuestionAt = (
    quizIdx: number,
    questionIdx: number,
    patch: Partial<QuizQuestion>
  ) => {
    updateQuizQuestions(quizIdx, (questions) =>
      questions.map((question, index) =>
        index === questionIdx ? { ...question, ...patch } : question
      )
    )
  }

  const updateQuizAt = (quizIdx: number, patch: Partial<QuizItem>) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((quiz, index) =>
        index === quizIdx ? { ...quiz, ...patch } : quiz
      ),
    })
  }

  const deleteQuizAt = async (quizIdx: number) => {
    const base = pending ?? data?.quizzes
    if (!base || saving) return
    const next = {
      ...base,
      quizzes: base.quizzes
        .filter((_, index) => index !== quizIdx)
        .map((quiz, index) => ({ ...quiz, quizIndex: index })),
    }
    setPending(next)
    setSaving(true)
    setSaveError(null)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      await api.updateQuizzes(bookLabel, next)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      setPending(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      await minDelay
      setSaving(false)
    }
  }

  const renderQuestionEditor = (
    quizIdx: number,
    question: QuizQuestion,
    questionIdx: number,
    options: { showTitle?: boolean } = {}
  ) => {
    const quiz = quizzes[quizIdx]
    const uploadPageId = quiz?.pageIds?.[0] ?? quiz?.afterPageId ?? pages[0]?.pageId ?? ""
    if (question.activityType === "multiple_choice" || question.activityType === "multiple_select") {
      const isMultipleSelect = question.activityType === "multiple_select"
      const answerIndexes = new Set(question.answerIndexes ?? [])
      const toggleAnswerIndex = (optionIdx: number) => {
        if (!isMultipleSelect) {
          updateQuestionAt(quizIdx, questionIdx, { answerIndex: optionIdx })
          return
        }
        const next = new Set(answerIndexes)
        if (next.has(optionIdx)) next.delete(optionIdx)
        else next.add(optionIdx)
        updateQuestionAt(quizIdx, questionIdx, { answerIndexes: Array.from(next).sort((a, b) => a - b) })
      }
      return (
        <div className="space-y-2">
          <textarea
            value={question.question}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
            className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            rows={1}
          />
          {(question.options ?? []).map((option, optionIdx) => (
            <div
              key={optionIdx}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-md ${
                (isMultipleSelect ? answerIndexes.has(optionIdx) : optionIdx === question.answerIndex)
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleAnswerIndex(optionIdx)}
                aria-pressed={isMultipleSelect ? answerIndexes.has(optionIdx) : optionIdx === question.answerIndex}
                aria-label={(isMultipleSelect ? answerIndexes.has(optionIdx) : optionIdx === question.answerIndex)
                  ? t`Correct answer`
                  : t`Set option ${String(optionIdx + 1)} as correct answer`}
                className="mt-1.5 rounded-full p-0.5 transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(isMultipleSelect ? answerIndexes.has(optionIdx) : optionIdx === question.answerIndex) ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4 opacity-30" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <textarea
                    value={option.text}
                    onChange={(e) => {
                      const options = (question.options ?? []).map((o, i) =>
                        i === optionIdx ? { ...o, text: e.target.value } : o
                      )
                      updateQuestionAt(quizIdx, questionIdx, { options })
                    }}
                    className="w-full text-sm resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                    rows={1}
                  />
                  <QuizImageButton
                    bookLabel={bookLabel}
                    uploadPageId={uploadPageId}
                    apiKey={apiKey}
                    providerCredentials={providerCredentials}
                    image={option.image}
                    label={t`Option ${String(optionIdx + 1)}`}
                    onChange={(image) => {
                      const options = (question.options ?? []).map((o, i) =>
                        i === optionIdx ? { ...o, image } : o
                      )
                      updateQuestionAt(quizIdx, questionIdx, { options })
                    }}
                  />
                </div>
                <textarea
                  value={option.explanation}
                  onChange={(e) => {
                    const options = (question.options ?? []).map((o, i) =>
                      i === optionIdx ? { ...o, explanation: e.target.value } : o
                    )
                    updateQuestionAt(quizIdx, questionIdx, { options })
                  }}
                  className="w-full text-xs opacity-70 resize-none rounded border border-transparent bg-transparent p-1 -m-1 mt-0.5 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
                  rows={1}
                />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (question.activityType === "true_false") {
      const statements = question.statements && question.statements.length > 0
        ? question.statements
        : [{ text: "", answer: true }]
      return (
        <div className="space-y-2">
          {options.showTitle && (
            <textarea
              value={question.question}
              onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
          )}
          {statements.map((statement, statementIdx) => (
            <div key={statementIdx} className="space-y-2">
              <textarea
                value={statement.text}
                onChange={(e) => {
                  const nextStatements = statements.map((s, i) =>
                    i === statementIdx ? { ...s, text: e.target.value } : s
                  )
                  updateQuestionAt(quizIdx, questionIdx, { statements: nextStatements })
                }}
                className="w-full text-sm resize-none rounded border bg-muted/40 p-2 focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <div className="inline-flex overflow-hidden rounded-md border bg-background p-0.5">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => {
                      const nextStatements = statements.map((s, i) =>
                        i === statementIdx ? { ...s, answer: value } : s
                      )
                      updateQuestionAt(quizIdx, questionIdx, { statements: nextStatements })
                    }}
                    className={`h-7 px-3 text-xs font-medium transition-colors ${
                      statement.answer === value ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {value ? t`True` : t`False`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (question.activityType === "fill_in_the_blank") {
      return (
        <div className="space-y-2">
          {options.showTitle && (
            <textarea
              value={question.question}
              onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
          )}
          {(question.blanks ?? []).map((blank, blankIdx) => (
            <div key={blankIdx} className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <textarea
                value={blank.prompt}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, prompt: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="min-h-10 text-sm resize-none rounded border bg-muted/40 p-2 focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <input
                value={blank.answer}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, answer: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                value={blank.explanation ?? ""}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, explanation: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="min-h-9 text-xs resize-none rounded border bg-background p-2 focus:outline-none focus:ring-1 focus:ring-ring sm:col-span-2"
                rows={1}
                placeholder={t`Explanation`}
              />
            </div>
          ))}
        </div>
      )
    }

    if (question.activityType === "open_ended") {
      return (
        <div className="space-y-2">
          <textarea
            value={question.question}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
            className="w-full min-h-20 resize-none rounded border bg-muted/40 p-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            aria-label={t`Open ended prompt`}
          />
          <textarea
            value={question.sampleAnswer ?? ""}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { sampleAnswer: e.target.value })}
            className="w-full min-h-16 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
            placeholder={t`Sample answer`}
            aria-label={t`Sample answer`}
          />
          <textarea
            value={question.guidance ?? ""}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { guidance: e.target.value })}
            className="w-full min-h-14 resize-none rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
            placeholder={t`Guidance`}
            aria-label={t`Guidance`}
          />
        </div>
      )
    }

    if (question.activityType === "sorting") {
      const categories = question.categories && question.categories.length > 0
        ? question.categories
        : [{ label: "" }, { label: "" }]
      const sortingItems = question.sortingItems ?? []
      return (
        <div className="space-y-3">
          {options.showTitle && (
            <textarea
              value={question.question}
              onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category, categoryIdx) => (
              <label key={categoryIdx} className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t`Category ${String(categoryIdx + 1)}`}
                </span>
                <input
                  value={category.label}
                  onChange={(e) => {
                    const previousLabel = category.label
                    const nextLabel = e.target.value
                    const nextCategories = categories.map((c, i) =>
                      i === categoryIdx ? { ...c, label: nextLabel } : c
                    )
                    const nextItems = sortingItems.map((item) =>
                      item.category === previousLabel ? { ...item, category: nextLabel } : item
                    )
                    updateQuestionAt(quizIdx, questionIdx, { categories: nextCategories, sortingItems: nextItems })
                  }}
                  className="h-9 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            {sortingItems.map((item, itemIdx) => (
              <div key={itemIdx} className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <div className="flex items-start gap-2">
                  <textarea
                    value={item.item}
                    onChange={(e) => {
                      const nextItems = sortingItems.map((candidate, i) =>
                        i === itemIdx ? { ...candidate, item: e.target.value } : candidate
                      )
                      updateQuestionAt(quizIdx, questionIdx, { sortingItems: nextItems })
                    }}
                    className="min-h-9 min-w-0 flex-1 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={1}
                  />
                  <QuizImageButton
                    bookLabel={bookLabel}
                    uploadPageId={uploadPageId}
                    apiKey={apiKey}
                    providerCredentials={providerCredentials}
                    image={item.image}
                    label={t`Sorting item ${String(itemIdx + 1)}`}
                    onChange={(image) => {
                      const nextItems = sortingItems.map((candidate, i) =>
                        i === itemIdx ? { ...candidate, image } : candidate
                      )
                      updateQuestionAt(quizIdx, questionIdx, { sortingItems: nextItems })
                    }}
                  />
                </div>
                <select
                  value={item.category}
                  onChange={(e) => {
                    const nextItems = sortingItems.map((candidate, i) =>
                      i === itemIdx ? { ...candidate, category: e.target.value } : candidate
                    )
                    updateQuestionAt(quizIdx, questionIdx, { sortingItems: nextItems })
                  }}
                  className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label={t`Sorting category`}
                >
                  {categories.map((category, categoryIdx) => (
                    <option key={categoryIdx} value={category.label}>
                      {category.label || t`Category ${String(categoryIdx + 1)}`}
                    </option>
                  ))}
                </select>
                <textarea
                  value={item.explanation ?? ""}
                  onChange={(e) => {
                    const nextItems = sortingItems.map((candidate, i) =>
                      i === itemIdx ? { ...candidate, explanation: e.target.value } : candidate
                    )
                    updateQuestionAt(quizIdx, questionIdx, { sortingItems: nextItems })
                  }}
                  className="min-h-9 resize-none rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring sm:col-span-2"
                  rows={1}
                  placeholder={t`Explanation`}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {options.showTitle && (
          <textarea
            value={question.question}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
            className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            rows={1}
          />
        )}
        {(question.pairs ?? []).map((pair, pairIdx) => (
          <div key={pairIdx} className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <textarea
                value={pair.item}
                onChange={(e) => {
                  const pairs = (question.pairs ?? []).map((p, i) =>
                    i === pairIdx ? { ...p, item: e.target.value } : p
                  )
                  updateQuestionAt(quizIdx, questionIdx, { pairs })
                }}
                className="min-h-9 min-w-0 flex-1 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                rows={1}
              />
              <QuizImageButton
                bookLabel={bookLabel}
                uploadPageId={uploadPageId}
                apiKey={apiKey}
                providerCredentials={providerCredentials}
                image={pair.itemImage}
                label={t`Match item ${String(pairIdx + 1)}`}
                onChange={(image) => {
                  const pairs = (question.pairs ?? []).map((p, i) =>
                    i === pairIdx ? { ...p, itemImage: image } : p
                  )
                  updateQuestionAt(quizIdx, questionIdx, { pairs })
                }}
              />
            </div>
            <div className="flex items-start gap-2">
              <textarea
                value={pair.match}
                onChange={(e) => {
                  const pairs = (question.pairs ?? []).map((p, i) =>
                    i === pairIdx ? { ...p, match: e.target.value } : p
                  )
                  updateQuestionAt(quizIdx, questionIdx, { pairs })
                }}
                className="min-h-9 min-w-0 flex-1 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                rows={1}
              />
              <QuizImageButton
                bookLabel={bookLabel}
                uploadPageId={uploadPageId}
                apiKey={apiKey}
                providerCredentials={providerCredentials}
                image={pair.matchImage}
                label={t`Match answer ${String(pairIdx + 1)}`}
                onChange={(image) => {
                  const pairs = (question.pairs ?? []).map((p, i) =>
                    i === pairIdx ? { ...p, matchImage: image } : p
                  )
                  updateQuestionAt(quizIdx, questionIdx, { pairs })
                }}
              />
            </div>
            <textarea
              value={pair.explanation ?? ""}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((p, i) =>
                  i === pairIdx ? { ...p, explanation: e.target.value } : p
                )
                updateQuestionAt(quizIdx, questionIdx, { pairs })
              }}
              className="min-h-9 resize-none rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring sm:col-span-2"
              rows={1}
              placeholder={t`Explanation`}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {canUseTextbookActivities && (
        <SegmentedControl<QuizSourceMode>
          value={sourceMode}
          onValueChange={setSourceMode}
          color="#ea580c"
          className="max-w-xl"
          options={[
            { value: "ai", label: t`AI generated` },
            { value: "textbook", label: t`Textbook activities` },
          ]}
        />
      )}

      {canUseTextbookActivities && sourceMode === "textbook" ? (
        <TextbookActivitiesPanel
          bookLabel={bookLabel}
          pages={pages}
          apiKey={apiKey}
          providerCredentials={providerCredentials}
          onOpenInStoryboard={(activity) => {
            const targetPageId = activity.override?.assignedPageIds?.[0] ?? activity.pageId
            const targetSectionIndex = targetPageId === activity.pageId ? activity.sectionIndex : 0
            skipNextResetRef.current = true
            setSectionIndex(targetSectionIndex)
            navigate({
              to: "/books/$label/$step/$pageId",
              params: { label: bookLabel, step: "storyboard", pageId: targetPageId },
            })
          }}
        />
      ) : (
        <>
          <QuizzesLandingConfig
            bookLabel={bookLabel}
            apiKey={apiKey}
            hasApiKey={hasApiKey}
            providerCredentials={providerCredentials}
            initialSelectedPageId={selectedPageId}
          />
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          {selectedPageId && displayQuizzes.length === 0 && quizzes.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                <HelpCircle className="w-6 h-6 text-orange-300" />
              </div>
              <p className="text-sm font-medium">{t`No activities for this page`}</p>
              <p className="text-xs mt-1">{t`Activities are linked to other pages in this book`}</p>
            </div>
          )}
          {isLoading && quizzes.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">{t`Loading activities...`}</span>
            </div>
          )}
          {displayQuizzes.map((quiz) => {
            const idx = quizzes.indexOf(quiz)
            const questions = getQuizQuestions(quiz)
            const activityType = questions[0]?.activityType ?? "multiple_choice"
            const sharedTitle = activityType === "multiple_choice" || activityType === "multiple_select" || activityType === "open_ended"
              ? null
              : getSharedQuestionTitle(questions)
            const hasKnownPlacementPage = pages.some((page) => page.pageId === quiz.afterPageId)
            return (
            <div key={idx} className={`rounded-md border bg-card overflow-hidden ${quiz.isPruned ? "opacity-55" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-muted/20 border-b">
                <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${activityBadgeClass(activityType)}`}>
                  {getActivityLabel(activityType)}
                </span>
                <label className="inline-flex h-7 max-w-full items-center gap-1.5 rounded border border-input bg-background px-2 text-[10px]">
                  <span className="whitespace-nowrap font-medium text-muted-foreground">{t`Insert after`}</span>
                  <select
                    value={quiz.afterPageId}
                    onChange={(e) => updateQuizAt(idx, { afterPageId: e.target.value })}
                    aria-label={t`Insert after page`}
                    className="min-w-[120px] max-w-[220px] bg-transparent text-[10px] focus:outline-none"
                  >
                    {!hasKnownPlacementPage && (
                      <option value={quiz.afterPageId}>{getPlacementLabel(quiz.afterPageId)}</option>
                    )}
                    {pages.map((page) => (
                      <option key={page.pageId} value={page.pageId}>
                        {t`Page ${String(page.pageNumber)}`} ({page.pageId})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setTryQuizIndex(quizzes.filter((q) => !q.isPruned).indexOf(quiz))}
                  disabled={quiz.isPruned}
                  className="ml-auto inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-[10px] font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye className="h-3 w-3" />
                  {t`Try`}
                </button>
                <button
                  type="button"
                  onClick={() => updateQuizAt(idx, { isPruned: !quiz.isPruned })}
                  className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-[10px] font-medium transition-colors hover:bg-muted/60"
                >
                  <Scissors className="h-3 w-3" />
                  {quiz.isPruned ? t`Unprune` : t`Prune`}
                </button>
                {quiz.isPruned && (
                  <button
                    type="button"
                    onClick={() => void deleteQuizAt(idx)}
                    disabled={saving}
                    className="inline-flex h-7 items-center gap-1 rounded border border-red-200 bg-red-50 px-2 text-[10px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title={t`Delete pruned quiz`}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t`Delete`}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-muted/10 border-b">
                {quiz.pageIds.length > 0 ? (
                  quiz.pageIds.map((pageId) => (
                    <PageThumb key={pageId} bookLabel={bookLabel} pageId={pageId} onClick={() => setLightboxPageId(pageId)} />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{getPlacementLabel(quiz.afterPageId)}</span>
                )}
              </div>
              <div className="px-4 py-3 space-y-4">
                {sharedTitle && (
                  <textarea
                    value={sharedTitle}
                    onChange={(e) => updateSharedTitle(idx, e.target.value)}
                    className="w-full text-sm font-semibold resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                    rows={1}
                  />
                )}
                <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                  {getPlacementLabel(quiz.afterPageId)}
                </span>
              </div>
              <div className="px-4 pb-3 space-y-4">
                {questions.map((question, questionIdx) => (
                  <div key={questionIdx} className="rounded-md border bg-muted/20 p-3 space-y-2">
                    {questions.length > 1 && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t`Q${String(questionIdx + 1)}`}
                      </p>
                    )}
                    {renderQuestionEditor(idx, question, questionIdx, {
                      showTitle: activityType !== "multiple_choice" && activityType !== "multiple_select" && !sharedTitle,
                    })}
                  </div>
                ))}
                {quiz.reasoning && (
                  <p className="text-xs italic text-muted-foreground px-1 pt-1">{quiz.reasoning}</p>
                )}
              </div>
            </div>
            )
          })}
        </>
      )}
      <PageLightbox
        bookLabel={bookLabel}
        pageId={lightboxPageId}
        open={lightboxPageId != null}
        onOpenChange={(open) => {
          if (!open) setLightboxPageId(null)
        }}
      />
      <Dialog open={tryQuizIndex != null} onOpenChange={(open) => { if (!open) setTryQuizIndex(null) }}>
        <DialogContent className="h-[85vh] w-[min(1100px,96vw)] max-w-[96vw] gap-0 overflow-hidden p-0 bg-white">
          <DialogTitle className="sr-only">{t`Try quiz`}</DialogTitle>
          <DialogDescription className="sr-only">{t`Interactive preview for the selected quiz.`}</DialogDescription>
          <div className="flex h-11 items-center border-b px-3 pr-12">
            <span className="text-xs font-medium text-muted-foreground">{t`Try`}</span>
          </div>
          {tryQuizIndex != null && (
            <iframe
              title={t`Quiz preview`}
              className="h-[calc(85vh-44px)] w-full bg-white"
              src={`/api/books/${bookLabel}/adt-preview/qz${pad3(tryQuizIndex + 1)}.html?embed=1&v=${data?.version ?? 0}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
