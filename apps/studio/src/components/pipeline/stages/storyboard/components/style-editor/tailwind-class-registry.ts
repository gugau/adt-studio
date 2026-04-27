/* eslint-disable lingui/no-unlocalized-strings */
// Tailwind class registry: utility class data + parsing helpers shared by the
// floating toolbar (legacy) and the right-sidebar style editor.

export interface TwEntry {
  cls: string
  label: string
}

export const TAILWIND_CATEGORIES: { name: string; entries: TwEntry[] }[] = [
  {
    name: "Text Size",
    entries: [
      { cls: "text-xs", label: "Extra Small (12px)" },
      { cls: "text-sm", label: "Small (14px)" },
      { cls: "text-base", label: "Base (16px)" },
      { cls: "text-lg", label: "Large (18px)" },
      { cls: "text-xl", label: "XL (20px)" },
      { cls: "text-2xl", label: "2XL (24px)" },
      { cls: "text-3xl", label: "3XL (30px)" },
      { cls: "text-4xl", label: "4XL (36px)" },
      { cls: "text-5xl", label: "5XL (48px)" },
      { cls: "text-6xl", label: "6XL (60px)" },
      { cls: "text-7xl", label: "7XL (72px)" },
      { cls: "text-8xl", label: "8XL (96px)" },
      { cls: "text-9xl", label: "9XL (128px)" },
    ],
  },
  {
    name: "Font Weight",
    entries: [
      { cls: "font-thin", label: "Thin (100)" },
      { cls: "font-extralight", label: "Extra Light (200)" },
      { cls: "font-light", label: "Light (300)" },
      { cls: "font-normal", label: "Normal (400)" },
      { cls: "font-medium", label: "Medium (500)" },
      { cls: "font-semibold", label: "Semi Bold (600)" },
      { cls: "font-bold", label: "Bold (700)" },
      { cls: "font-extrabold", label: "Extra Bold (800)" },
      { cls: "font-black", label: "Black (900)" },
    ],
  },
  {
    name: "Font Style",
    entries: [
      { cls: "italic", label: "Italic" },
      { cls: "not-italic", label: "Not Italic" },
      { cls: "underline", label: "Underline" },
      { cls: "no-underline", label: "No Underline" },
      { cls: "line-through", label: "Strikethrough" },
      { cls: "uppercase", label: "UPPERCASE" },
      { cls: "lowercase", label: "lowercase" },
      { cls: "capitalize", label: "Capitalize" },
      { cls: "normal-case", label: "Normal Case" },
    ],
  },
  {
    name: "Text Align",
    entries: [
      { cls: "text-left", label: "Left" },
      { cls: "text-center", label: "Center" },
      { cls: "text-right", label: "Right" },
      { cls: "text-justify", label: "Justify" },
    ],
  },
  {
    name: "Line Height",
    entries: [
      { cls: "leading-none", label: "None (1)" },
      { cls: "leading-tight", label: "Tight (1.25)" },
      { cls: "leading-snug", label: "Snug (1.375)" },
      { cls: "leading-normal", label: "Normal (1.5)" },
      { cls: "leading-relaxed", label: "Relaxed (1.625)" },
      { cls: "leading-loose", label: "Loose (2)" },
    ],
  },
  {
    name: "Letter Spacing",
    entries: [
      { cls: "tracking-tighter", label: "Tighter (-0.05em)" },
      { cls: "tracking-tight", label: "Tight (-0.025em)" },
      { cls: "tracking-normal", label: "Normal (0)" },
      { cls: "tracking-wide", label: "Wide (0.025em)" },
      { cls: "tracking-wider", label: "Wider (0.05em)" },
      { cls: "tracking-widest", label: "Widest (0.1em)" },
    ],
  },
  {
    name: "Spacing",
    entries: [
      { cls: "p-0", label: "Padding 0" },
      { cls: "p-1", label: "Padding 4px" },
      { cls: "p-2", label: "Padding 8px" },
      { cls: "p-3", label: "Padding 12px" },
      { cls: "p-4", label: "Padding 16px" },
      { cls: "p-6", label: "Padding 24px" },
      { cls: "p-8", label: "Padding 32px" },
      { cls: "px-1", label: "Horizontal Padding 4px" },
      { cls: "px-2", label: "Horizontal Padding 8px" },
      { cls: "px-4", label: "Horizontal Padding 16px" },
      { cls: "px-6", label: "Horizontal Padding 24px" },
      { cls: "py-1", label: "Vertical Padding 4px" },
      { cls: "py-2", label: "Vertical Padding 8px" },
      { cls: "py-4", label: "Vertical Padding 16px" },
      { cls: "py-6", label: "Vertical Padding 24px" },
      { cls: "m-0", label: "Margin 0" },
      { cls: "m-1", label: "Margin 4px" },
      { cls: "m-2", label: "Margin 8px" },
      { cls: "m-4", label: "Margin 16px" },
      { cls: "m-auto", label: "Margin Auto" },
      { cls: "mx-auto", label: "Horizontal Margin Auto" },
      { cls: "my-2", label: "Vertical Margin 8px" },
      { cls: "my-4", label: "Vertical Margin 16px" },
    ],
  },
  {
    name: "Layout",
    entries: [
      { cls: "block", label: "Block" },
      { cls: "inline-block", label: "Inline Block" },
      { cls: "inline", label: "Inline" },
      { cls: "flex", label: "Flexbox" },
      { cls: "grid", label: "Grid" },
      { cls: "hidden", label: "Hidden" },
      { cls: "w-full", label: "Width 100%" },
      { cls: "w-auto", label: "Width Auto" },
      { cls: "w-1/2", label: "Width 50%" },
      { cls: "w-1/3", label: "Width 33%" },
      { cls: "w-2/3", label: "Width 67%" },
      { cls: "h-auto", label: "Height Auto" },
      { cls: "max-w-sm", label: "Max Width 384px" },
      { cls: "max-w-md", label: "Max Width 448px" },
      { cls: "max-w-lg", label: "Max Width 512px" },
      { cls: "max-w-xl", label: "Max Width 576px" },
      { cls: "max-w-full", label: "Max Width 100%" },
    ],
  },
  {
    name: "Border & Rounded",
    entries: [
      { cls: "border", label: "Border 1px" },
      { cls: "border-0", label: "No Border" },
      { cls: "border-2", label: "Border 2px" },
      { cls: "rounded", label: "Rounded 4px" },
      { cls: "rounded-md", label: "Rounded 6px" },
      { cls: "rounded-lg", label: "Rounded 8px" },
      { cls: "rounded-xl", label: "Rounded 12px" },
      { cls: "rounded-full", label: "Fully Rounded" },
      { cls: "rounded-none", label: "No Rounding" },
    ],
  },
  {
    name: "Effects",
    entries: [
      { cls: "shadow-sm", label: "Small Shadow" },
      { cls: "shadow", label: "Shadow" },
      { cls: "shadow-md", label: "Medium Shadow" },
      { cls: "shadow-lg", label: "Large Shadow" },
      { cls: "opacity-50", label: "50% Opacity" },
      { cls: "opacity-75", label: "75% Opacity" },
      { cls: "opacity-100", label: "Full Opacity" },
    ],
  },
  {
    name: "Image",
    entries: [
      { cls: "object-cover", label: "Cover (crop to fill)" },
      { cls: "object-contain", label: "Contain (fit inside)" },
      { cls: "object-fill", label: "Fill (stretch)" },
      { cls: "object-none", label: "None (original size)" },
      { cls: "object-center", label: "Position Center" },
      { cls: "object-top", label: "Position Top" },
      { cls: "object-bottom", label: "Position Bottom" },
    ],
  },
]

export const TW_VARIANTS = [
  "sm", "md", "lg", "xl", "2xl",
  "hover", "focus", "active", "focus-within", "focus-visible",
  "first", "last", "odd", "even",
  "dark",
  "print",
  "group-hover",
  "peer-checked",
] as const

export function parseClass(cls: string): { variant: string; base: string } {
  const colonIdx = cls.indexOf(":")
  if (colonIdx === -1) return { variant: "", base: cls }
  return { variant: cls.slice(0, colonIdx + 1), base: cls.slice(colonIdx + 1) }
}

export const TW_COLOR_NAMES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky",
  "blue", "indigo", "violet", "purple", "fuchsia",
  "pink", "rose",
] as const

export const TW_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const

export const TW_HEX: Record<string, Record<string, string>> = {
  slate:   { "50":"#f8fafc","100":"#f1f5f9","200":"#e2e8f0","300":"#cbd5e1","400":"#94a3b8","500":"#64748b","600":"#475569","700":"#334155","800":"#1e293b","900":"#0f172a","950":"#020617" },
  gray:    { "50":"#f9fafb","100":"#f3f4f6","200":"#e5e7eb","300":"#d1d5db","400":"#9ca3af","500":"#6b7280","600":"#4b5563","700":"#374151","800":"#1f2937","900":"#111827","950":"#030712" },
  zinc:    { "50":"#fafafa","100":"#f4f4f5","200":"#e4e4e7","300":"#d4d4d8","400":"#a1a1aa","500":"#71717a","600":"#52525b","700":"#3f3f46","800":"#27272a","900":"#18181b","950":"#09090b" },
  neutral: { "50":"#fafafa","100":"#f5f5f5","200":"#e5e5e5","300":"#d4d4d4","400":"#a3a3a3","500":"#737373","600":"#525252","700":"#404040","800":"#262626","900":"#171717","950":"#0a0a0a" },
  stone:   { "50":"#fafaf9","100":"#f5f5f4","200":"#e7e5e4","300":"#d6d3d1","400":"#a8a29e","500":"#78716c","600":"#57534e","700":"#44403c","800":"#292524","900":"#1c1917","950":"#0c0a09" },
  red:     { "50":"#fef2f2","100":"#fee2e2","200":"#fecaca","300":"#fca5a5","400":"#f87171","500":"#ef4444","600":"#dc2626","700":"#b91c1c","800":"#991b1b","900":"#7f1d1d","950":"#450a0a" },
  orange:  { "50":"#fff7ed","100":"#ffedd5","200":"#fed7aa","300":"#fdba74","400":"#fb923c","500":"#f97316","600":"#ea580c","700":"#c2410c","800":"#9a3412","900":"#7c2d12","950":"#431407" },
  amber:   { "50":"#fffbeb","100":"#fef3c7","200":"#fde68a","300":"#fcd34d","400":"#fbbf24","500":"#f59e0b","600":"#d97706","700":"#b45309","800":"#92400e","900":"#78350f","950":"#451a03" },
  yellow:  { "50":"#fefce8","100":"#fef9c3","200":"#fef08a","300":"#fde047","400":"#facc15","500":"#eab308","600":"#ca8a04","700":"#a16207","800":"#854d0e","900":"#713f12","950":"#422006" },
  lime:    { "50":"#f7fee7","100":"#ecfccb","200":"#d9f99d","300":"#bef264","400":"#a3e635","500":"#84cc16","600":"#65a30d","700":"#4d7c0f","800":"#3f6212","900":"#365314","950":"#1a2e05" },
  green:   { "50":"#f0fdf4","100":"#dcfce7","200":"#bbf7d0","300":"#86efac","400":"#4ade80","500":"#22c55e","600":"#16a34a","700":"#15803d","800":"#166534","900":"#14532d","950":"#052e16" },
  emerald: { "50":"#ecfdf5","100":"#d1fae5","200":"#a7f3d0","300":"#6ee7b7","400":"#34d399","500":"#10b981","600":"#059669","700":"#047857","800":"#065f46","900":"#064e3b","950":"#022c22" },
  teal:    { "50":"#f0fdfa","100":"#ccfbf1","200":"#99f6e4","300":"#5eead4","400":"#2dd4bf","500":"#14b8a6","600":"#0d9488","700":"#0f766e","800":"#115e59","900":"#134e4a","950":"#042f2e" },
  cyan:    { "50":"#ecfeff","100":"#cffafe","200":"#a5f3fc","300":"#67e8f9","400":"#22d3ee","500":"#06b6d4","600":"#0891b2","700":"#0e7490","800":"#155e75","900":"#164e63","950":"#083344" },
  sky:     { "50":"#f0f9ff","100":"#e0f2fe","200":"#bae6fd","300":"#7dd3fc","400":"#38bdf8","500":"#0ea5e9","600":"#0284c7","700":"#0369a1","800":"#075985","900":"#0c4a6e","950":"#082f49" },
  blue:    { "50":"#eff6ff","100":"#dbeafe","200":"#bfdbfe","300":"#93c5fd","400":"#60a5fa","500":"#3b82f6","600":"#2563eb","700":"#1d4ed8","800":"#1e40af","900":"#1e3a8a","950":"#172554" },
  indigo:  { "50":"#eef2ff","100":"#e0e7ff","200":"#c7d2fe","300":"#a5b4fc","400":"#818cf8","500":"#6366f1","600":"#4f46e5","700":"#4338ca","800":"#3730a3","900":"#312e81","950":"#1e1b4b" },
  violet:  { "50":"#f5f3ff","100":"#ede9fe","200":"#ddd6fe","300":"#c4b5fd","400":"#a78bfa","500":"#8b5cf6","600":"#7c3aed","700":"#6d28d9","800":"#5b21b6","900":"#4c1d95","950":"#2e1065" },
  purple:  { "50":"#faf5ff","100":"#f3e8ff","200":"#e9d5ff","300":"#d8b4fe","400":"#c084fc","500":"#a855f7","600":"#9333ea","700":"#7e22ce","800":"#6b21a8","900":"#581c87","950":"#3b0764" },
  fuchsia: { "50":"#fdf4ff","100":"#fae8ff","200":"#f5d0fe","300":"#f0abfc","400":"#e879f9","500":"#d946ef","600":"#c026d3","700":"#a21caf","800":"#86198f","900":"#701a75","950":"#4a044e" },
  pink:    { "50":"#fdf2f8","100":"#fce7f3","200":"#fbcfe8","300":"#f9a8d4","400":"#f472b6","500":"#ec4899","600":"#db2777","700":"#be185d","800":"#9d174d","900":"#831843","950":"#500724" },
  rose:    { "50":"#fff1f2","100":"#ffe4e6","200":"#fecdd3","300":"#fda4af","400":"#fb7185","500":"#f43f5e","600":"#e11d48","700":"#be123c","800":"#9f1239","900":"#881337","950":"#4c0519" },
}

function buildColorEntries(prefix: "text" | "bg" | "border"): TwEntry[] {
  const specials: TwEntry[] = [
    { cls: `${prefix}-black`, label: "Black" },
    { cls: `${prefix}-white`, label: "White" },
  ]
  if (prefix === "bg") specials.push({ cls: "bg-transparent", label: "Transparent" })
  const palette: TwEntry[] = []
  for (const color of TW_COLOR_NAMES) {
    for (const shade of TW_SHADES) {
      const name = color.charAt(0).toUpperCase() + color.slice(1)
      palette.push({ cls: `${prefix}-${color}-${shade}`, label: `${name} ${shade}` })
    }
  }
  return [...specials, ...palette]
}

export const TEXT_COLOR_ENTRIES = buildColorEntries("text")
export const BG_COLOR_ENTRIES = buildColorEntries("bg")
export const BORDER_COLOR_ENTRIES = buildColorEntries("border")

export const COLOR_CATEGORIES: { name: string; entries: TwEntry[] }[] = [
  { name: "Text Color", entries: TEXT_COLOR_ENTRIES },
  { name: "Background", entries: BG_COLOR_ENTRIES },
  { name: "Border Color", entries: BORDER_COLOR_ENTRIES },
]

const ALL_CATEGORIES = [...TAILWIND_CATEGORIES, ...COLOR_CATEGORIES]

const CLASS_LABEL_MAP = new Map<string, string>()
const CLASS_CATEGORY_MAP = new Map<string, string>()
const CATEGORY_ENTRIES_MAP = new Map<string, TwEntry[]>()

for (const cat of ALL_CATEGORIES) {
  CATEGORY_ENTRIES_MAP.set(cat.name, cat.entries)
  for (const e of cat.entries) {
    CLASS_LABEL_MAP.set(e.cls, e.label)
    CLASS_CATEGORY_MAP.set(e.cls, cat.name)
  }
}

export const SEARCHABLE_ENTRIES: TwEntry[] = TAILWIND_CATEGORIES.flatMap((c) => c.entries)

export function getLabel(cls: string): string {
  return CLASS_LABEL_MAP.get(cls) ?? cls
}

export function getCategoryEntries(name: string): TwEntry[] | undefined {
  return CATEGORY_ENTRIES_MAP.get(name)
}

export function lookupBase(fullCls: string): {
  variant: string
  base: string
  label: string
  category: string | undefined
  entries: TwEntry[] | undefined
  isColor: boolean
} {
  const { variant, base } = parseClass(fullCls)
  const label = getLabel(base)
  const category = CLASS_CATEGORY_MAP.get(base)
  const entries = category ? CATEGORY_ENTRIES_MAP.get(category) : undefined
  const isColor = colorHexFromBase(base) !== null
  return { variant, base, label, category, entries, isColor }
}

export function colorHexFromBase(base: string): string | null {
  const arb = base.match(/^(?:text|bg|border)-\[(#[0-9a-fA-F]{3,8})\]$/)
  if (arb) return arb[1]
  if (base.endsWith("-black")) return "#000000"
  if (base.endsWith("-white")) return "#ffffff"
  if (base === "bg-transparent") return "transparent"
  const m = base.match(/^(?:text|bg|border)-(\w+)-(\d+)$/)
  if (m) return TW_HEX[m[1]]?.[m[2]] ?? null
  return null
}

export function colorHexFromClass(cls: string): string | null {
  return colorHexFromBase(parseClass(cls).base)
}

export function colorPrefixFromBase(base: string): "text" | "bg" | "border" | null {
  if (base.startsWith("bg-")) return "bg"
  if (base.startsWith("border-")) return "border"
  if (base.startsWith("text-") && colorHexFromBase(base) !== null) return "text"
  return null
}
