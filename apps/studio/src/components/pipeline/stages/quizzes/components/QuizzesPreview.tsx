import { CheckCircle2, Circle, HelpCircle } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n as linguiI18n } from "@lingui/core"
import type { MessageDescriptor } from "@lingui/core"

type SampleOption = {
  text: MessageDescriptor
  correct?: boolean
}

const SAMPLE_QUESTION = msg`What is the main role of a plant's roots?`

const SAMPLE_OPTIONS: SampleOption[] = [
  { text: msg`They absorb water and nutrients from the soil.`, correct: true },
  { text: msg`They produce flowers to attract pollinators.` },
  { text: msg`They release oxygen directly into the air.` },
]

export function QuizzesPreview({
  pagesPerQuiz,
  mode = "frequency",
}: {
  pagesPerQuiz: number
  mode?: "frequency" | "specific"
}) {
  const frequency = Number.isFinite(pagesPerQuiz) && pagesPerQuiz > 0 ? pagesPerQuiz : 3

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-orange-50/40 via-white to-white">
      <span className="absolute right-4 top-4 z-10 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-700">
        <Trans>Sample</Trans>
      </span>

      <div className="flex w-full h-full items-center justify-center p-4 min-h-0">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[#f1f1f1] px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </span>
            <h2 className="text-[14px] font-semibold text-[#0a0a0a]">
              <Trans>Quiz</Trans>
            </h2>
            <span className="ml-auto text-[10px] font-medium text-[#a3a3a3]">
              {mode === "specific" ? (
                <Trans>Single quiz</Trans>
              ) : (
                <Trans>1 quiz / {frequency} pages</Trans>
              )}
            </span>
          </div>

          <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pt-4 pb-3">
            <p className="text-[13px] font-semibold leading-snug text-[#0a0a0a]">
              {linguiI18n._(SAMPLE_QUESTION)}
            </p>

            <div className="flex flex-col gap-2">
              {SAMPLE_OPTIONS.map((option, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 ${
                    option.correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-[#eee] bg-[#fafafa] text-[#737373]"
                  }`}
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                >
                  {option.correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-40" aria-hidden />
                  )}
                  <span className="text-[12px] leading-snug">
                    {linguiI18n._(option.text)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
