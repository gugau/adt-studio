import { useState } from "react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"
import { ColorInput } from "../controls/ColorInput"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const FAMILY_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
]

const SIZE_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
].map((v) => ({ value: v, label: v }))

const WEIGHT_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
].map((v) => ({ value: v, label: v }))

const LEADING_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  "none",
  "tight",
  "snug",
  "normal",
  "relaxed",
  "loose",
].map((v) => ({ value: v, label: v }))

export function TypographySection() {
  const { t } = useLingui()
  const [fontFamily, setFontFamily] = useState("sans")
  const [fontSize, setFontSize] = useState("base")
  const [weight, setWeight] = useState("normal")
  const [decor, setDecor] = useState<string[]>([])
  const [align, setAlign] = useState("left")
  const [leading, setLeading] = useState("normal")
  const [textColor, setTextColor] = useState("#000000")

  const decorItems = [
    { value: "italic", icon: Italic, label: t`Italic` },
    { value: "underline", icon: Underline, label: t`Underline` },
    { value: "strike", icon: Strikethrough, label: t`Strikethrough` },
  ]

  const alignItems = [
    { value: "left", icon: AlignLeft, label: t`Align left` },
    { value: "center", icon: AlignCenter, label: t`Align center` },
    { value: "right", icon: AlignRight, label: t`Align right` },
    { value: "justify", icon: AlignJustify, label: t`Justify` },
  ]

  return (
    <Section title={<Trans>Typography</Trans>}>
      <StyleLabel label={<Trans>Family</Trans>}>
        <Select value={fontFamily} onChange={setFontFamily} options={FAMILY_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Size</Trans>}>
        <Select value={fontSize} onChange={setFontSize} options={SIZE_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Weight</Trans>}>
        <Select value={weight} onChange={setWeight} options={WEIGHT_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Style</Trans>}>
        <ToggleGroup
          type="multiple"
          size="xs"
          value={decor}
          onValueChange={setDecor}
        >
          {decorItems.map(({ value, icon: Icon, label }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </StyleLabel>
      <StyleLabel label={<Trans>Align</Trans>}>
        <ToggleGroup
          type="single"
          size="xs"
          sliding
          value={align}
          onValueChange={(v) => v && setAlign(v)}
        >
          {alignItems.map(({ value, icon: Icon, label }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </StyleLabel>
      <StyleLabel label={<Trans>Leading</Trans>}>
        <Select value={leading} onChange={setLeading} options={LEADING_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Text</Trans>}>
        <ColorInput value={textColor} onChange={setTextColor} />
      </StyleLabel>
    </Section>
  )
}
