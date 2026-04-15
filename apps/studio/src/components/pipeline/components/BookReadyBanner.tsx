import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { X, HelpCircle, Image, BookOpen, Languages, AudioLines, FileDown } from "lucide-react"
import { Trans } from "@lingui/react/macro"

const STORAGE_KEY = "adt:book-ready-dismissed"

function isDismissed(bookLabel: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const set: string[] = JSON.parse(raw)
    return set.includes(bookLabel)
  } catch {
    return false
  }
}

function setDismissed(bookLabel: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const set: string[] = raw ? JSON.parse(raw) : []
    if (!set.includes(bookLabel)) {
      set.push(bookLabel)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(set))
    }
  } catch {
    // ignore
  }
}

const OPTIONAL_FEATURES = [
  { slug: "quizzes" as const, icon: HelpCircle, label: "Quizzes", color: "text-orange-500", bg: "bg-orange-50" },
  { slug: "captions" as const, icon: Image, label: "Captions", color: "text-teal-500", bg: "bg-teal-50" },
  { slug: "glossary" as const, icon: BookOpen, label: "Glossary", color: "text-lime-600", bg: "bg-lime-50" },
  { slug: "translate" as const, icon: Languages, label: "Translate", color: "text-pink-500", bg: "bg-pink-50" },
  { slug: "speech" as const, icon: AudioLines, label: "Speech", color: "text-rose-500", bg: "bg-rose-50" },
]

export function BookReadyBanner({ bookLabel }: { bookLabel: string }) {
  const [visible, setVisible] = useState(() => !isDismissed(bookLabel))

  if (!visible) return null

  const handleDismiss = () => {
    setDismissed(bookLabel)
    setVisible(false)
  }

  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-violet-50/80 to-indigo-50/80 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">
            <Trans>Your book is ready to export!</Trans>
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            <Trans>You can export now, or enhance it with optional features:</Trans>
          </p>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {OPTIONAL_FEATURES.map((feature) => (
              <Link
                key={feature.slug}
                to="/books/$label/$step"
                params={{ label: bookLabel, step: feature.slug }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${feature.bg} ${feature.color} hover:opacity-80 transition-opacity`}
              >
                <feature.icon className="w-3 h-3" />
                {feature.label}
              </Link>
            ))}
          </div>

          {/* Export CTA */}
          <Link
            to="/books/$label/$step"
            params={{ label: bookLabel, step: "export" }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <FileDown className="w-3 h-3" />
            <Trans>Export</Trans>
          </Link>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded hover:bg-black/5 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
