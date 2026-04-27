import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { ChevronDown, Plus, Search, X } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  type TwEntry,
  TAILWIND_CATEGORIES,
  COLOR_CATEGORIES,
  TW_VARIANTS,
  TW_COLOR_NAMES,
  TW_SHADES,
  TW_HEX,
  SEARCHABLE_ENTRIES,
  lookupBase,
  getLabel,
  getCategoryEntries,
  colorHexFromBase,
  colorPrefixFromBase,
} from "./tailwind-class-registry"

function ColorSwatch({ hex, size = "sm" }: { hex: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
  if (hex === "transparent") {
    return (
      <span
        className={`${dim} rounded-sm border border-border/50 shrink-0`}
        style={{ background: "repeating-conic-gradient(#d4d4d4 0% 25%, white 0% 50%) 50% / 6px 6px" }}
      />
    )
  }
  return (
    <span
      className={`${dim} rounded-sm border border-border/50 shrink-0`}
      style={{ backgroundColor: hex }}
    />
  )
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  if (!text || (typeof children === "string" && text === children)) return <>{children}</>
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 text-[9px] font-sans text-popover-foreground bg-popover border rounded shadow-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-[70]">
        {text}
      </span>
    </span>
  )
}

function ColorPalettePanel({
  prefix,
  currentClass,
  onSelect,
}: {
  prefix: "text" | "bg" | "border"
  currentClass: string | null
  onSelect: (cls: string) => void
}) {
  const { t } = useLingui()
  const [customHex, setCustomHex] = useState("")

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-1">
        {/* eslint-disable-next-line lingui/no-unlocalized-strings -- Tailwind class names */}
        {[`${prefix}-black`, `${prefix}-white`, ...(prefix === "bg" ? ["bg-transparent"] : [])].map((cls) => {
          const hex = colorHexFromBase(cls)!
          const active = cls === currentClass
          return (
            <button
              key={cls}
              type="button"
              title={getLabel(cls)}
              onClick={() => onSelect(cls)}
              className={`p-0.5 rounded cursor-pointer transition-all ${active ? "ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"}`}
            >
              <ColorSwatch hex={hex} size="md" />
            </button>
          )
        })}
      </div>
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${TW_SHADES.length}, 1fr)` }}>
        {TW_COLOR_NAMES.map((color) =>
          TW_SHADES.map((shade) => {
            const cls = `${prefix}-${color}-${shade}`
            const hex = TW_HEX[color]?.[shade]
            if (!hex) return <span key={cls} />
            const active = cls === currentClass
            return (
              <button
                key={cls}
                type="button"
                title={`${color}-${shade}`}
                onClick={() => onSelect(cls)}
                className={`w-full aspect-square rounded-[2px] cursor-pointer transition-all ${active ? "ring-2 ring-blue-500 ring-offset-1 z-10" : "hover:scale-125 hover:z-10"}`}
                style={{ backgroundColor: hex }}
              />
            )
          })
        )}
      </div>
      <div className="flex items-center gap-1.5 px-1 pt-1 border-t">
        <span className="text-[10px] text-muted-foreground"><Trans>Custom:</Trans></span>
        <div className="flex items-center gap-1 flex-1">
          <input
            type="color"
            value={customHex || "#000000"}
            onChange={(e) => {
              setCustomHex(e.target.value)
              onSelect(`${prefix}-[${e.target.value}]`)
            }}
            className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
          />
          <input
            type="text"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && /^#[0-9a-fA-F]{3,8}$/.test(customHex.trim())) {
                onSelect(`${prefix}-[${customHex.trim()}]`)
              }
            }}
            placeholder="#hex" // eslint-disable-line lingui/no-unlocalized-strings -- format hint
            className="text-[10px] font-mono bg-muted/50 rounded px-1.5 py-0.5 w-[70px] outline-none placeholder:text-muted-foreground"
            title={t`Enter hex color and press Enter`}
          />
        </div>
      </div>
    </div>
  )
}

function CategorySwapDropdown({
  currentBase,
  variant,
  categoryName,
  entries,
  onSelect,
  onClose,
}: {
  currentBase: string
  variant: string
  categoryName: string
  entries: TwEntry[]
  onSelect: (fullCls: string) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const isColor = COLOR_CATEGORIES.some((c) => c.name === categoryName)
  const colorPrefix = colorPrefixFromBase(currentBase)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onCloseRef.current()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSelect = useCallback((baseCls: string) => {
    onSelect(variant + baseCls)
  }, [variant, onSelect])

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-[60] overflow-hidden"
      style={{ minWidth: isColor ? 220 : 200 }}
    >
      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 border-b flex items-center gap-1">
        {variant && <span className="text-blue-500">{variant}</span>}
        {categoryName}
      </div>
      {isColor && colorPrefix ? (
        <div className="p-2">
          <ColorPalettePanel prefix={colorPrefix} currentClass={currentBase} onSelect={(cls) => { handleSelect(cls); onClose() }} />
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto py-1">
          {entries.map((e) => {
            const active = e.cls === currentBase
            const hex = colorHexFromBase(e.cls)
            return (
              <button
                key={e.cls}
                type="button"
                onClick={() => { handleSelect(e.cls); onClose() }}
                className={`w-full text-left flex items-center gap-2 px-2 py-1 text-[11px] cursor-pointer transition-colors ${active ? "bg-accent font-medium" : "hover:bg-accent/50"}`}
              >
                {hex && <ColorSwatch hex={hex} />}
                <span className="font-mono text-[10px] shrink-0">{variant}{e.cls}</span>
                <span className="text-muted-foreground truncate">{e.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClassChip({
  cls,
  onRemove,
  onSwap,
}: {
  cls: string
  onRemove: () => void
  onSwap: (newCls: string) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(cls)
  const inputRef = useRef<HTMLInputElement>(null)

  const { variant, base, label, category, entries, isColor } = lookupBase(cls)
  const hex = colorHexFromBase(base)
  const isSwappable = (!!entries && entries.length > 1) || isColor
  const tooltipText = variant ? `${variant} ${label}` : label

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing])

  const commitEdit = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== cls) {
      onSwap(trimmed)
    } else {
      setEditValue(cls)
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center text-[10px] font-mono bg-blue-50 rounded px-0.5 py-0.5 ring-1 ring-blue-300">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit()
            if (e.key === "Escape") { setEditing(false); setEditValue(cls) }
          }}
          onBlur={commitEdit}
          className="bg-transparent outline-none text-[10px] font-mono w-[120px]"
        />
      </span>
    )
  }

  return (
    <Tooltip text={tooltipText}>
      <span className="relative inline-flex items-center gap-0.5 text-[10px] font-mono bg-muted rounded pl-1 pr-0.5 py-0.5 group">
        {hex && <ColorSwatch hex={hex} />}
        {variant && <span className="text-blue-500">{variant}</span>}
        {isSwappable ? (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onDoubleClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setEditing(true) }}
            className="flex items-center gap-0.5 cursor-pointer hover:text-blue-600 transition-colors"
          >
            {base}
            <ChevronDown className="h-2 w-2 opacity-50 group-hover:opacity-100" />
          </button>
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            className="cursor-default"
          >
            {base}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-0 ml-0.5 rounded hover:bg-destructive/20 transition-colors cursor-pointer opacity-50 group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
        {dropdownOpen && (
          isColor && !category ? (
            (() => {
              const cp = colorPrefixFromBase(base) ?? "text"
              // eslint-disable-next-line lingui/no-unlocalized-strings -- category lookup keys
              const catName = cp === "bg" ? "Background" : cp === "border" ? "Border Color" : "Text Color"
              const catEntries = getCategoryEntries(catName) ?? []
              return (
                <CategorySwapDropdown
                  currentBase={base}
                  variant={variant}
                  categoryName={catName}
                  entries={catEntries}
                  onSelect={onSwap}
                  onClose={() => setDropdownOpen(false)}
                />
              )
            })()
          ) : entries && category ? (
            <CategorySwapDropdown
              currentBase={base}
              variant={variant}
              categoryName={category}
              entries={entries}
              onSelect={onSwap}
              onClose={() => setDropdownOpen(false)}
            />
          ) : null
        )}
      </span>
    </Tooltip>
  )
}

function ClassPicker({
  currentClasses,
  onAdd,
}: {
  currentClasses: string[]
  onAdd: (cls: string) => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [selectedVariant, setSelectedVariant] = useState("")
  const [showVariants, setShowVariants] = useState(false)
  const [expandedColorCat, setExpandedColorCat] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
    else { setFilter(""); setSelectedVariant(""); setShowVariants(false); setExpandedColorCat(null) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const lowerFilter = filter.toLowerCase()

  const filtered = useMemo(() => {
    if (!lowerFilter) return null
    const seen = new Set<string>()
    const results: TwEntry[] = []
    for (const e of SEARCHABLE_ENTRIES) {
      if (!seen.has(e.cls) && !currentClasses.includes(selectedVariant + e.cls) && (e.cls.includes(lowerFilter) || e.label.toLowerCase().includes(lowerFilter))) {
        seen.add(e.cls)
        results.push(e)
      }
    }
    for (const cat of COLOR_CATEGORIES) {
      for (const e of cat.entries) {
        if (!seen.has(e.cls) && !currentClasses.includes(selectedVariant + e.cls) && e.cls.includes(lowerFilter)) {
          seen.add(e.cls)
          results.push(e)
        }
      }
    }
    return results
  }, [lowerFilter, currentClasses, selectedVariant])

  const addWithVariant = useCallback((cls: string) => {
    onAdd(selectedVariant + cls)
  }, [selectedVariant, onAdd])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
        title={t`Add class`}
      >
        <Plus className="h-3 w-3" />
        <Trans>Add class</Trans>
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 px-1.5 py-0.5 rounded bg-blue-50 cursor-pointer"
      >
        <Plus className="h-3 w-3" />
        <Trans>Add class</Trans>
      </button>
      <div className="absolute top-full left-0 mt-1 w-[300px] bg-popover border rounded-lg shadow-lg z-[60] overflow-hidden">
        <div className="px-1.5 pt-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => setShowVariants(!showVariants)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showVariants ? "rotate-0" : "-rotate-90"}`} />
            {selectedVariant ? (
              <span><Trans>Variant:</Trans> <span className="font-mono text-blue-600">{selectedVariant}</span></span>
            ) : (
              <Trans>Responsive / State variants</Trans>
            )}
          </button>
          {showVariants && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedVariant("")}
                className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${!selectedVariant ? "bg-blue-100 text-blue-700 font-medium" : "bg-muted hover:bg-accent"}`}
              >
                <Trans>base</Trans>
              </button>
              {TW_VARIANTS.map((v) => {
                const prefix = `${v}:`
                const active = selectedVariant === prefix
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVariant(active ? "" : prefix)}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${active ? "bg-blue-100 text-blue-700 font-medium" : "bg-muted hover:bg-accent"}`}
                  >
                    {v}:
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="px-1.5 pb-1.5 pt-0.5 border-b">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1">
            {selectedVariant && <span className="text-[10px] font-mono text-blue-500 shrink-0">{selectedVariant}</span>}
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false)
                if (e.key === "Enter" && filter.trim()) {
                  let target = filtered?.[0]?.cls ?? filter.trim()
                  if (selectedVariant && target.startsWith(selectedVariant)) {
                    target = target.slice(selectedVariant.length)
                  }
                  const full = selectedVariant + target
                  if (!currentClasses.includes(full)) {
                    onAdd(full)
                    setFilter("")
                  }
                }
              }}
              placeholder={t`Type class name or search...`}
              className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered !== null ? (
            filtered.length === 0 ? (
              <div className="text-[10px] text-muted-foreground px-2 py-3 text-center">
                {filter.trim() ? (
                  <span>
                    <Trans>Press Enter to add</Trans>{" "}
                    <code className="bg-muted px-1 rounded">{selectedVariant}{filter.trim()}</code>
                  </span>
                ) : (
                  <Trans>No matches</Trans>
                )}
              </div>
            ) : (
              <div className="py-0.5">
                {filtered.slice(0, 50).map((e) => {
                  const hex = colorHexFromBase(e.cls)
                  return (
                    <button
                      key={e.cls}
                      type="button"
                      onClick={() => { addWithVariant(e.cls); setFilter("") }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 text-[11px] rounded cursor-pointer hover:bg-accent transition-colors"
                    >
                      {hex && <ColorSwatch hex={hex} />}
                      <span className="font-mono text-[10px] shrink-0">{selectedVariant}{e.cls}</span>
                      <span className="text-muted-foreground truncate">{e.label}</span>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <>
              {TAILWIND_CATEGORIES.map((cat) => {
                const available = cat.entries.filter((e) => !currentClasses.includes(selectedVariant + e.cls))
                if (available.length === 0) return null
                return (
                  <div key={cat.name} className="mb-2 last:mb-0">
                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5">
                      {cat.name}
                    </div>
                    {available.map((e) => {
                      const hex = colorHexFromBase(e.cls)
                      return (
                        <button
                          key={e.cls}
                          type="button"
                          onClick={() => addWithVariant(e.cls)}
                          className="w-full text-left flex items-center gap-2 px-2 py-0.5 text-[11px] rounded cursor-pointer hover:bg-accent transition-colors"
                        >
                          {hex && <ColorSwatch hex={hex} />}
                          <span className="font-mono text-[10px] shrink-0">{selectedVariant}{e.cls}</span>
                          <span className="text-muted-foreground truncate">{e.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {COLOR_CATEGORIES.map((cat) => {
                const prefix = cat.name === "Background" ? "bg" as const
                  : cat.name === "Border Color" ? "border" as const
                  : "text" as const
                const isExpanded = expandedColorCat === cat.name
                return (
                  <div key={cat.name} className="mb-2 last:mb-0">
                    <button
                      type="button"
                      onClick={() => setExpandedColorCat(isExpanded ? null : cat.name)}
                      className="w-full flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 hover:text-foreground cursor-pointer transition-colors"
                    >
                      <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                      {cat.name}
                    </button>
                    {isExpanded && (
                      <div className="px-1.5 pt-1">
                        <ColorPalettePanel prefix={prefix} currentClass={null} onSelect={addWithVariant} />
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface RawClassChipsProps {
  classes: string[]
  onRemove: (cls: string) => void
  onAdd: (cls: string) => void
  onSwap: (oldCls: string, newCls: string) => void
}

export function RawClassChips({ classes, onRemove, onAdd, onSwap }: RawClassChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {classes.map((cls) => (
        <ClassChip
          key={cls}
          cls={cls}
          onRemove={() => onRemove(cls)}
          onSwap={(newCls) => onSwap(cls, newCls)}
        />
      ))}
      <ClassPicker currentClasses={classes} onAdd={onAdd} />
    </div>
  )
}
