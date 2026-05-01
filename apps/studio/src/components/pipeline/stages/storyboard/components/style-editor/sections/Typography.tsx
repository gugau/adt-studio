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
import {
  fontFamilyClassMap,
  fontSizeClassMap,
  fontWeightClassMap,
  textAlignClassMap,
  lineHeightClassMap,
  textDecorationClassMap,
  textColorClassMap,
} from "../class-maps"
import { useElementStyles } from "../use-element-styles"

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

const EMPTY_DECOR: string[] = []

export function TypographySection() {
  const { t } = useLingui()
  const fontFamily = useElementStyles(fontFamilyClassMap, "sans")
  const fontSize = useElementStyles(fontSizeClassMap, "base")
  const weight = useElementStyles(fontWeightClassMap, "normal")
  const decor = useElementStyles(textDecorationClassMap, EMPTY_DECOR)
  const align = useElementStyles(textAlignClassMap, "left")
  const leading = useElementStyles(lineHeightClassMap, "normal")
  const textColor = useElementStyles(textColorClassMap, "")

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
      <StyleLabel label={<Trans>Family</Trans>} override={fontFamily.override}>
        <Select value={fontFamily.value} onChange={fontFamily.setValue} options={FAMILY_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Size</Trans>} override={fontSize.override}>
        <Select value={fontSize.value} onChange={fontSize.setValue} options={SIZE_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Weight</Trans>} override={weight.override}>
        <Select value={weight.value} onChange={weight.setValue} options={WEIGHT_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Style</Trans>} override={decor.override}>
        <ToggleGroup
          type="multiple"
          size="xs"
          value={decor.value}
          onValueChange={decor.setValue}
        >
          {decorItems.map(({ value, icon: Icon, label }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </StyleLabel>
      <StyleLabel label={<Trans>Align</Trans>} override={align.override}>
        <ToggleGroup
          type="single"
          size="xs"
          sliding
          value={align.value}
          onValueChange={(v) => v && align.setValue(v)}
        >
          {alignItems.map(({ value, icon: Icon, label }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </StyleLabel>
      <StyleLabel label={<Trans>Leading</Trans>} override={leading.override}>
        <Select value={leading.value} onChange={leading.setValue} options={LEADING_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Text</Trans>} override={textColor.override}>
        <ColorInput value={textColor.value} onChange={textColor.setValue} />
      </StyleLabel>
    </Section>
  )
}
