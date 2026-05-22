import { useCallback } from "react"
import { useLingui } from "@lingui/react/macro"
import { useBook } from "@/hooks/use-books"

/**
 * Composes a book-context paragraph (summary + language + authors + a
 * stage-specific closing hint) that landing pages drop into their
 * "Custom Instructions"-style textareas via an Auto-fill action.
 *
 * `closingHint` is the per-stage trailing sentence (e.g. for Captions:
 * "When describing images, mention any culturally specific objects..."). Pass
 * an already-translated string via Lingui's `t` so the locale propagates.
 *
 * Returns the compose function plus a `canAutoFill` boolean — true once the
 * book metadata has loaded.
 */
export function useComposeBookContext(bookLabel: string, closingHint: string) {
  const { t, i18n } = useLingui()
  const { data: book } = useBook(bookLabel)

  const compose = useCallback((): string => {
    if (!book) return ""
    const parts: string[] = []
    const summary = book.bookSummary?.summary?.trim()
    if (summary) {
      parts.push(summary)
    } else if (book.title) {
      parts.push(t`This book is titled "${book.title}".`)
    }
    if (book.languageCode) {
      try {
        const langName = new Intl.DisplayNames([i18n.locale], {
          type: "language",
        }).of(book.languageCode)
        if (langName) parts.push(t`The book is written in ${langName}.`)
      } catch {
        // ignore invalid locale codes
      }
    }
    if (book.authors && book.authors.length > 0) {
      const authorsList = book.authors.join(", ")
      parts.push(t`Authored by ${authorsList}.`)
    }
    if (closingHint) parts.push(closingHint)
    return parts.join(" ")
  }, [book, i18n, t, closingHint])

  return { compose, canAutoFill: Boolean(book) }
}
