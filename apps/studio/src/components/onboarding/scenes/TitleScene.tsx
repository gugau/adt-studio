import { useEffect, useState } from "react"
import { useLingui } from "@lingui/react/macro"
import type { OnboardingStepProps } from "../steps"

export function TitleScene({ onNext }: OnboardingStepProps) {
  const { t } = useLingui()
  const fullText = t`Meet ADT Studio`
  const [typed, setTyped] = useState("")

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(fullText.slice(0, i))
      if (i >= fullText.length) clearInterval(id)
    }, 60)
    return () => clearInterval(id)
  }, [fullText])

  useEffect(() => {
    const id = setTimeout(() => onNext(), 2400 + fullText.length * 60)
    return () => clearTimeout(id)
  }, [onNext, fullText.length])

  return (
    <div className="relative flex h-full w-full items-center justify-center p-8">
      <h1 className="text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
        {typed}
        <span
          className="ml-1 inline-block h-[0.9em] w-[3px] -translate-y-[4px] align-middle bg-foreground"
          style={{ animation: "onboarding-caret 1s steps(2) infinite" }}
        />
      </h1>
    </div>
  )
}
