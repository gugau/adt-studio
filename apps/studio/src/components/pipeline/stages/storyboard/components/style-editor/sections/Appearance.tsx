import { useEffect, useRef, useState } from "react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"
import { ColorInput } from "../controls/ColorInput"
import {
  backgroundColorClassMap,
  opacityClassMap,
  shadowClassMap,
} from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const SHADOW_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: "none", label: "None" },
  { value: "sm", label: "sm" },
  { value: "DEFAULT", label: "Default" },
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
  { value: "xl", label: "xl" },
  { value: "2xl", label: "2xl" },
]

export function AppearanceSection() {
  const { value: bgColor, setValue: setBgColor } = useElementStyles(
    backgroundColorClassMap,
    ""
  )
  const { value: opacity, setValue: setOpacity } = useElementStyles(
    opacityClassMap,
    100
  )
  // Local draft so dragging the slider doesn't fire a class update / refreshCss
  // per tick. Commits 200ms after the user stops moving (or on release).
  const [opacityDraft, setOpacityDraft] = useState(opacity)
  useEffect(() => setOpacityDraft(opacity), [opacity])
  const opacityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (opacityTimerRef.current) clearTimeout(opacityTimerRef.current)
    },
    []
  )
  const handleOpacityChange = (next: number) => {
    setOpacityDraft(next)
    if (opacityTimerRef.current) clearTimeout(opacityTimerRef.current)
    opacityTimerRef.current = setTimeout(() => {
      opacityTimerRef.current = null
      setOpacity(next)
    }, 200)
  }
  const flushOpacity = () => {
    if (opacityTimerRef.current) {
      clearTimeout(opacityTimerRef.current)
      opacityTimerRef.current = null
      if (opacityDraft !== opacity) setOpacity(opacityDraft)
    }
  }
  const { value: shadow, setValue: setShadow } = useElementStyles(
    shadowClassMap,
    "none"
  )

  return (
    <Section title={<Trans>Appearance</Trans>}>
      <StyleLabel label={<Trans>Background</Trans>}>
        <ColorInput value={bgColor} onChange={setBgColor} />
      </StyleLabel>
      <StyleLabel label={<Trans>Opacity</Trans>}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={opacityDraft}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
          onMouseUp={flushOpacity}
          onKeyUp={flushOpacity}
          className="flex-1 accent-violet-500"
        />
        <span className="text-[11px] tabular-nums w-8 text-right text-muted-foreground">
          {opacityDraft}%
        </span>
      </StyleLabel>
      <StyleLabel label={<Trans>Shadow</Trans>}>
        <Select value={shadow} onChange={setShadow} options={SHADOW_OPTIONS} />
      </StyleLabel>
    </Section>
  )
}
