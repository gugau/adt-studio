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
] as const satisfies readonly RenderStrategyOption[]

export type RenderStrategyId = (typeof RENDER_STRATEGIES)[number]["id"]

export const RENDER_STRATEGY_IDS = RENDER_STRATEGIES.map((s) => s.id) as RenderStrategyId[]

// ─── Output Languages (future step) ─────────────────────────────────────────

export const OUTPUT_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
] as const

export type OutputLanguageId = (typeof OUTPUT_LANGUAGES)[number]["id"]

// ─── Preset defaults — typed against the option IDs above ────────────────────

export type SectioningModeId = "page" | "dynamic" | "section"


export type WizardPageGrouping = "" | "spread" | "single"

export type WizardSectioningMode = "" | SectioningModeId

export interface PresetDefaults {
  layoutType: string
  renderStrategy: RenderStrategyId | ""
  pageGrouping: WizardPageGrouping
  sectioningMode: WizardSectioningMode
}

// ─── Preset types ────────────────────────────────────────────────────────────

export type PresetId = "textbook" | "storybook" | "reference" | "custom"

export interface PresetFeature {
  id: string
  label: string
  description: string
}

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
  features: PresetFeature[]
  defaults: PresetDefaults
}

// ─── Shared features ─────────────────────────────────────────────────────────

const FEATURE_AUTO_GLOSSARY: PresetFeature = {
  id: "auto-glossary",
  label: "Auto-Glossary",
  description: "AI detects and defines complex terms automatically.",
}

const FEATURE_EASY_READ: PresetFeature = {
  id: "easy-read",
  label: "Easy-Read Mode",
  description: "Generate a simplified version of the text.",
}

const FEATURE_QUIZ: PresetFeature = {
  id: "quiz-generation",
  label: "Quiz Generation",
  description:
    "Identifies key educational concepts and generates interactive multiple-choice questions.",
}

const FEATURE_SPEECH: PresetFeature = {
  id: "speech-generation",
  label: "Speech Generation",
  description:
    "Enables a page-level audio player with the ability to hear specific phrases by clicking directly on the text.",
}

const FEATURE_ALT_TEXT: PresetFeature = {
  id: "alt-text",
  label: "Technical Alt-Text",
  description:
    "Generates detailed alt-text for diagrams, charts, and technical figures.",
}

const FEATURE_ACTIVITIES: PresetFeature = {
  id: "activities",
  label: "Activity Conversion",
  description:
    "Automatically converts interactive activities into accessible digital formats.",
}

const FEATURE_CHAPTER_NAV: PresetFeature = {
  id: "chapter-nav",
  label: "Chapter Navigation",
  description:
    "Generates a structured table of contents with deep links to each chapter.",
}

const FEATURE_EXPRESSIVE_TTS: PresetFeature = {
  id: "expressive-tts",
  label: "Expressive TTS Voices",
  description: "Uses storyteller-style voices tuned for young audiences.",
}

const FEATURE_GLOSSARY_TABLES: PresetFeature = {
  id: "glossary-tables",
  label: "Glossaries & Tables",
  description: "Extracts and preserves tables, glossaries, and structured lists.",
}

const FEATURE_RENDER_CONTROL: PresetFeature = {
  id: "render-control",
  label: "Render Strategy Control",
  description:
    "Full control over per-type render strategies (LLM, template, activity).",
}

const FEATURE_CUSTOM_PRUNING: PresetFeature = {
  id: "custom-pruning",
  label: "Custom Pruning & Filters",
  description: "Define which text and section types to include or exclude.",
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
    features: [
      FEATURE_AUTO_GLOSSARY,
      FEATURE_QUIZ,
      FEATURE_ALT_TEXT,
      FEATURE_ACTIVITIES,
      FEATURE_SPEECH,
    ],
    defaults: { layoutType: "textbook", renderStrategy: "two_column", pageGrouping: "single", sectioningMode: "section" },
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
    features: [
      FEATURE_CHAPTER_NAV,
      FEATURE_SPEECH,
      FEATURE_EXPRESSIVE_TTS,
      FEATURE_EASY_READ,
    ],
    defaults: { layoutType: "storybook", renderStrategy: "two_column_story", pageGrouping: "spread", sectioningMode: "section" },
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
    features: [
      FEATURE_GLOSSARY_TABLES,
      FEATURE_ALT_TEXT,
      FEATURE_AUTO_GLOSSARY,
      FEATURE_SPEECH,
    ],
    defaults: { layoutType: "reference", renderStrategy: "two_column", pageGrouping: "single", sectioningMode: "section" },
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
    features: [
      FEATURE_RENDER_CONTROL,
      FEATURE_CUSTOM_PRUNING,
      FEATURE_ALT_TEXT,
      FEATURE_AUTO_GLOSSARY,
      FEATURE_QUIZ,
      FEATURE_SPEECH,
      FEATURE_EASY_READ,
    ],
    defaults: { layoutType: "", renderStrategy: "", pageGrouping: "", sectioningMode: "" },
  },
]

export const PRESET_DEFAULTS: Record<string, PresetDefaults> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p.defaults]),
)
