import {
  Sparkles,
  Layers,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import type { ElementType } from "react"
import { TwoColumnStoryStrategyIcon } from "@/components/wizard/icons/TwoColumnStoryStrategyIcon"
import { TextbookWireframePreview } from "@/components/wizard/icons/TextbookWireframePreview"
import { StorybookWireframePreview } from "@/components/wizard/icons/StorybookWireframePreview"
import { ReferenceWireframePreview } from "@/components/wizard/icons/ReferenceWireframePreview"
import type { WizardFormValues } from "./wizardForm"

// ─── Option shape ────────────────────────────────────────────────────────────

export interface WizardOption<TId extends string = string> {
  id: TId
  Icon?: ElementType
  title: MessageDescriptor
  description?: MessageDescriptor
}

// ─── Render Strategy categories ──────────────────────────────────────────────

export type StrategyCategory = "template" | "ai"

export interface StrategyCategoryMeta {
  label: MessageDescriptor
  description: MessageDescriptor
}

export const STRATEGY_CATEGORIES: Record<StrategyCategory, StrategyCategoryMeta> = {
  template: {
    label: msg`Template-based`,
    description: msg`Fast, consistent results with no AI cost`,
  },
  ai: {
    label: msg`AI-powered`,
    description: msg`Adaptive layouts generated per page (slower, uses API credits)`,
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
    title: msg`Dynamic`,
    description: msg`Automatically adapts the layout based on each page's content using AI.`,
    category: "ai",
  },
  {
    id: "llm-overlay",
    Icon: Layers,
    title: msg`Dynamic Overlay`,
    description: msg`AI-powered layout that preserves the original page as a background with text overlay.`,
    category: "ai",
  },
  {
    id: "two_column",
    Icon: BookOpen,
    title: msg`Two Columns`,
    description: msg`The ideal choice for novels, focused on a clean and continuous reading experience.`,
    category: "template",
  },
  {
    id: "two_column_story",
    Icon: TwoColumnStoryStrategyIcon,
    title: msg`Two Columns Story`,
    description: msg`Perfect for children's books, pairing large images with minimal text.`,
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
  title: MessageDescriptor
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
  title: MessageDescriptor
  description: MessageDescriptor
  recommendedFor: MessageDescriptor[]
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
    Icon: TextbookWireframePreview,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/5",
    title: msg`Textbooks & Activities`,
    description: msg`Structured chapters, exercises. Best for educational content with complex layouts.`,
    recommendedFor: [
      msg`School textbooks and workbooks`,
      msg`University academic publications`,
      msg`Scientific papers and journals`,
      msg`Technical manuals with diagrams`,
    ],
    exampleBooks: [
      {
        title: msg`Práticas de Alfabetização e de Matemática`,
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: msg`Ciências da Natureza - Ensino Fundamental`, comingSoon: true },
      { title: msg`História e Sociedade - Vol. 1`, comingSoon: true },
      { title: msg`Língua Portuguesa - 3° Ano`, comingSoon: true },
    ],
    defaults: {
      layoutType: "textbook",
      renderStrategy: "llm",
      pageGrouping: "single",
      sectioningMode: "dynamic",
      imageCropping: false,
      imageSegmentation: true,
      imageFilterMinSide: 50,
      imageFilterMaxSide: 3500,
      styleguide: "default",
    },
  },
  {
    id: "storybook",
    imageSrc: null,
    Icon: StorybookWireframePreview,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500/5",
    title: msg`Storybook`,
    description: msg`Large images, narrative flow. Best for illustrated books with high-fidelity TTS voices.`,
    recommendedFor: [
      msg`Illustrated children's books`,
      msg`Young adult fiction`,
      msg`Chapter books with images`,
      msg`Picture books and early readers`,
    ],
    exampleBooks: [
      {
        title: msg`Sample Illustrated Story`,
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: msg`Adventure Tales - Vol. 1`, comingSoon: true },
      { title: msg`The Lost Forest`, comingSoon: true },
    ],
    defaults: {
      layoutType: "storybook",
      renderStrategy: "two_column_story",
      pageGrouping: "spread",
      sectioningMode: "page",
      imageCropping: false,
      imageSegmentation: false,
      imageFilterMinSide: 150,
      imageFilterMaxSide: 3500,
    },
  },
  {
    id: "reference",
    imageSrc: null,
    Icon: ReferenceWireframePreview,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500/5",
    title: msg`Reference`,
    description: msg`Dense text, tables, glossaries. Best for technical material and documentation.`,
    recommendedFor: [
      msg`Technical documentation`,
      msg`Legal and compliance manuals`,
      msg`Medical references`,
      msg`Engineering handbooks`,
    ],
    exampleBooks: [
      {
        title: msg`Sample Reference Manual`,
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: msg`Engineering Handbook Vol. 2`, comingSoon: true },
      { title: msg`Legal Compliance Guide`, comingSoon: true },
    ],
    defaults: {
      layoutType: "reference",
      renderStrategy: "two_column",
      pageGrouping: "single",
      sectioningMode: "page",
      imageCropping: false,
      imageSegmentation: false,
      imageFilterMinSide: 100,
      imageFilterMaxSide: 5000,
    },
  },
  {
    id: "custom",
    imageSrc: null,
    Icon: SlidersHorizontal,
    iconColor: "text-violet-500",
    bgColor: "bg-violet-500/5",
    title: msg`Custom`,
    description: msg`Full control over render strategies, pruning, and filters.`,
    recommendedFor: [
      msg`Any content type`,
      msg`Specialized workflows`,
      msg`Experimental configurations`,
      msg`Multi-format publications`,
    ],
    exampleBooks: [
      {
        title: msg`Custom Layout Demo`,
        pdfUrl: DEMO_PDF_URL,
        adtUrl: DEMO_ADT_URL,
      },
      { title: msg`Mixed Content Project`, comingSoon: true },
    ],
    defaults: {},
  },
]

export const PRESET_DEFAULTS: Record<PresetId, PresetDefaults> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p.defaults]),
) as Record<PresetId, PresetDefaults>


const FIELD_LABELS: Partial<Record<keyof WizardFormValues, MessageDescriptor>> = {
  renderStrategy: msg`Render Strategy`,
  pageGrouping: msg`Page Grouping`,
  sectioningMode: msg`Sectioning`,
  imageCropping: msg`Smart Cropping`,
  imageSegmentation: msg`Image Segmentation`,
  imageFilterMinSide: msg`Min Image Size`,
  imageFilterMaxSide: msg`Max Image Size`,
  styleguide: msg`Style Guide`,
}

const VALUE_LABELS: Record<string, MessageDescriptor> = {
  two_column: msg`Two Columns`,
  two_column_story: msg`Two Columns Story`,
  llm: msg`Dynamic`,
  "llm-overlay": msg`Dynamic Overlay`,
  single: msg`Single Page`,
  spread: msg`Spread`,
  page: msg`Per Page`,
  dynamic: msg`Dynamic`,
  section: msg`By Section`,
}

function formatDefaultValue(
  key: keyof WizardFormValues,
  value: unknown,
): MessageDescriptor | string {
  if (typeof value === "boolean") return value ? msg`On` : msg`Off`
  if (typeof value === "number") return `${value}px`
  const str = String(value)
  return VALUE_LABELS[str] ?? str
}

export function getPresetDefaultEntries(
  defaults: PresetDefaults,
): { label: MessageDescriptor; value: MessageDescriptor | string }[] {
  return Object.entries(defaults)
    .filter(([key]) => key in FIELD_LABELS)
    .map(([key, value]) => ({
      label: FIELD_LABELS[key as keyof WizardFormValues]!,
      value: formatDefaultValue(key as keyof WizardFormValues, value),
    }))
}
