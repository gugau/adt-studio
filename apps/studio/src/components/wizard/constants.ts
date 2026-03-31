/* eslint-disable lingui/no-unlocalized-strings */
import {
  Sparkles,
  Layers,
  BookOpen,
  GraduationCap,
  BookHeart,
  Library,
  SlidersHorizontal,
} from "lucide-react"
import type { ElementType } from "react"
import { TwoColumnStoryStrategyIcon } from "@/components/wizard/icons/TwoColumnStoryStrategyIcon"
import type { WizardFormValues } from "./wizardForm"

// ─── Option shape ────────────────────────────────────────────────────────────

export interface WizardOption<TId extends string = string> {
  id: TId
  Icon?: ElementType
  title: string
  description?: string
}

// ─── Render Strategy categories ──────────────────────────────────────────────

export type StrategyCategory = "template" | "ai"

export interface StrategyCategoryMeta {
  label: string
  description: string
}

export const STRATEGY_CATEGORIES: Record<StrategyCategory, StrategyCategoryMeta> = {
  template: {
    label: "Template-based",
    description: "Fast, consistent results with no AI cost",
  },
  ai: {
    label: "AI-powered",
    description: "Adaptive layouts generated per page (slower, uses API credits)",
  },
}

export interface RenderStrategyOption extends WizardOption {
  category: StrategyCategory
}

// ─── Render Strategies (Step 2) ──────────────────────────────────────────────

export const RENDER_STRATEGIES = [
  {
    id: "llm",
    Icon: Sparkles,
    title: "Dynamic",
    description:
      "Automatically adapts the layout based on each page's content using AI.",
    category: "ai",
  },
  {
    id: "llm-overlay",
    Icon: Layers,
    title: "Dynamic Overlay",
    description:
      "AI-powered layout that preserves the original page as a background with text overlay.",
    category: "ai",
  },
  {
    id: "two_column",
    Icon: BookOpen,
    title: "Two Columns",
    description:
      "The ideal choice for novels, focused on a clean and continuous reading experience.",
    category: "template",
  },
  {
    id: "two_column_story",
    Icon: TwoColumnStoryStrategyIcon,
    title: "Two Columns Story",
    description:
      "Perfect for children's books, pairing large images with minimal text.",
    category: "template",
  },
] as const satisfies readonly RenderStrategyOption[]

export type RenderStrategyId = (typeof RENDER_STRATEGIES)[number]["id"]

// ─── Preset defaults — typed against the wizard form ────────────────────────

export type SectioningModeId = "page" | "dynamic" | "section"

export type WizardPageGrouping = "" | "spread" | "single"

export type WizardSectioningMode = "" | SectioningModeId

export type PresetDefaults = Partial<WizardFormValues>

// ─── Preset types ────────────────────────────────────────────────────────────

export type PresetId = "textbook" | "storybook" | "reference" | "custom"

export interface ExampleBook {
  title: string
  pdfUrl?: string
  adtUrl?: string
  comingSoon?: boolean
}

export interface PresetConfig {
  id: PresetId
  imageSrc: string | null
  Icon: React.ElementType
  iconColor: string
  bgColor: string
  title: string
  description: string
  recommendedFor: string[]
  exampleBooks: ExampleBook[]
  defaults: PresetDefaults
}


// ─── Demo URLs (shared across all presets until per-preset assets are ready) ─

const DEMO_PDF_URL =
  "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
const DEMO_ADT_URL =
  "https://elasticsounds.github.io/adt-brazil-demo/index.html"

// ─── Presets ─────────────────────────────────────────────────────────────────

export const PRESETS: PresetConfig[] = [
  {
    id: "textbook",
    imageSrc: null,
    Icon: GraduationCap,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/5",
    title: "Textbooks & Academic",
    description:
      "Structured chapters, exercises. Best for educational content with complex layouts.",
    recommendedFor: [
      "School textbooks and workbooks",
      "University academic publications",
      "Scientific papers and journals",
      "Technical manuals with diagrams",
    ],
    exampleBooks: [
      {
        title: "Práticas de Alfabetização e de Matemática",
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: "Ciências da Natureza — Ensino Fundamental", comingSoon: true },
      { title: "História e Sociedade — Vol. 1", comingSoon: true },
      { title: "Língua Portuguesa — 3° Ano", comingSoon: true },
    ],
    defaults: {
      layoutType: "textbook",
      renderStrategy: "two_column",
      pageGrouping: "single",
      sectioningMode: "section",
      imageCropping: true,
      imageSegmentation: true,
    },
  },
  {
    id: "storybook",
    imageSrc: null,
    Icon: BookHeart,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500/5",
    title: "Storybook",
    description:
      "Large images, narrative flow. Best for illustrated books with high-fidelity TTS voices.",
    recommendedFor: [
      "Illustrated children's books",
      "Young adult fiction",
      "Chapter books with images",
      "Picture books and early readers",
    ],
    exampleBooks: [
      {
        title: "Sample Illustrated Story",
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: "Adventure Tales — Vol. 1", comingSoon: true },
      { title: "The Lost Forest", comingSoon: true },
    ],
    defaults: {
      layoutType: "storybook",
      renderStrategy: "two_column_story",
      pageGrouping: "spread",
      sectioningMode: "section",
      imageCropping: false,
      imageSegmentation: true,
    },
  },
  {
    id: "reference",
    imageSrc: null,
    Icon: Library,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500/5",
    title: "Reference",
    description:
      "Dense text, tables, glossaries. Best for technical material and documentation.",
    recommendedFor: [
      "Technical documentation",
      "Legal and compliance manuals",
      "Medical references",
      "Engineering handbooks",
    ],
    exampleBooks: [
      {
        title: "Sample Reference Manual",
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: "Engineering Handbook Vol. 2", comingSoon: true },
      { title: "Legal Compliance Guide", comingSoon: true },
    ],
    defaults: {
      layoutType: "reference",
      renderStrategy: "two_column",
      pageGrouping: "single",
      sectioningMode: "section",
      imageCropping: true,
      imageSegmentation: false,
    },
  },
  {
    id: "custom",
    imageSrc: null,
    Icon: SlidersHorizontal,
    iconColor: "text-violet-500",
    bgColor: "bg-violet-500/5",
    title: "Custom",
    description: "Full control over render strategies, pruning, and filters.",
    recommendedFor: [
      "Any content type",
      "Specialized workflows",
      "Experimental configurations",
      "Multi-format publications",
    ],
    exampleBooks: [
      {
        title: "Custom Layout Demo",
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: "Mixed Content Project", comingSoon: true },
    ],
    defaults: {},
  },
]

export const PRESET_DEFAULTS: Record<PresetId, PresetDefaults> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p.defaults]),
) as Record<PresetId, PresetDefaults>


const FIELD_LABELS: Partial<Record<keyof WizardFormValues, string>> = {
  renderStrategy: "Render Strategy",
  pageGrouping: "Page Grouping",
  sectioningMode: "Sectioning",
  imageCropping: "Smart Cropping",
  imageSegmentation: "Image Segmentation",
  imageFilterMinSide: "Min Image Size",
  imageFilterMaxSide: "Max Image Size",
  styleguide: "Style Guide",
}

const VALUE_LABELS: Record<string, string> = {
  two_column: "Two Columns",
  two_column_story: "Two Columns Story",
  llm: "Dynamic",
  "llm-overlay": "Dynamic Overlay",
  single: "Single Page",
  spread: "Spread",
  page: "Per Page",
  dynamic: "Dynamic",
  section: "By Section",
}

function formatDefaultValue(key: keyof WizardFormValues, value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (typeof value === "number") return `${value}px`
  const str = String(value)
  return VALUE_LABELS[str] ?? str
}

export function getPresetDefaultEntries(
  defaults: PresetDefaults,
): { label: string; value: string }[] {
  return Object.entries(defaults)
    .filter(([key]) => key in FIELD_LABELS)
    .map(([key, value]) => ({
      label: FIELD_LABELS[key as keyof WizardFormValues]!,
      value: formatDefaultValue(key as keyof WizardFormValues, value),
    }))
}
