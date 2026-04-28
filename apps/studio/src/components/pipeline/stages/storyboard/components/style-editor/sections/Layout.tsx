import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  StretchHorizontal,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  displayClassMap,
  flexDirectionClassMap,
  justifyContentClassMap,
  alignItemsClassMap,
  gapClassMap,
} from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const DISPLAY_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  "block",
  "inline-block",
  "inline",
  "flex",
  "grid",
  "hidden",
].map((v) => ({ value: v, label: v }))

export function LayoutSection() {
  const { t } = useLingui()
  const { value: display, setValue: setDisplay } = useElementStyles(
    displayClassMap,
    "block"
  )
  const { value: flexDir, setValue: setFlexDir } = useElementStyles(
    flexDirectionClassMap,
    "row"
  )
  const { value: justify, setValue: setJustify } = useElementStyles(
    justifyContentClassMap,
    "start"
  )
  const { value: align, setValue: setAlign } = useElementStyles(
    alignItemsClassMap,
    "start"
  )
  const { value: gap, setValue: setGap } = useElementStyles(gapClassMap, 0)

  const isFlex = display === "flex" || display === "grid"

  const directionItems = [
    { value: "row", icon: ArrowRight, label: t`Row` },
    { value: "row-reverse", icon: ArrowLeft, label: t`Row reverse` },
    { value: "col", icon: ArrowDown, label: t`Column` },
    { value: "col-reverse", icon: ArrowUp, label: t`Column reverse` },
  ]

  const isColumn = flexDir === "col" || flexDir === "col-reverse"

  const justifyItems = isColumn
    ? [
        { value: "start", icon: AlignVerticalJustifyStart, label: t`Start` },
        { value: "center", icon: AlignVerticalJustifyCenter, label: t`Center` },
        { value: "end", icon: AlignVerticalJustifyEnd, label: t`End` },
        { value: "between", icon: AlignHorizontalSpaceBetween, label: t`Space between` },
        { value: "around", icon: AlignHorizontalSpaceAround, label: t`Space around` },
      ]
    : [
        { value: "start", icon: AlignHorizontalJustifyStart, label: t`Start` },
        { value: "center", icon: AlignHorizontalJustifyCenter, label: t`Center` },
        { value: "end", icon: AlignHorizontalJustifyEnd, label: t`End` },
        { value: "between", icon: AlignHorizontalSpaceBetween, label: t`Space between` },
        { value: "around", icon: AlignHorizontalSpaceAround, label: t`Space around` },
      ]

  const alignItems = isColumn
    ? [
        { value: "start", icon: AlignHorizontalJustifyStart, label: t`Start` },
        { value: "center", icon: AlignHorizontalJustifyCenter, label: t`Center` },
        { value: "end", icon: AlignHorizontalJustifyEnd, label: t`End` },
        { value: "stretch", icon: StretchHorizontal, label: t`Stretch` },
      ]
    : [
        { value: "start", icon: AlignVerticalJustifyStart, label: t`Start` },
        { value: "center", icon: AlignVerticalJustifyCenter, label: t`Center` },
        { value: "end", icon: AlignVerticalJustifyEnd, label: t`End` },
        { value: "stretch", icon: StretchHorizontal, label: t`Stretch` },
      ]

  return (
    <Section title={<Trans>Layout</Trans>}>
      <StyleLabel label={<Trans>Display</Trans>}>
        <Select value={display} onChange={setDisplay} options={DISPLAY_OPTIONS} />
      </StyleLabel>
      {isFlex && (
        <>
          <StyleLabel label={<Trans>Direction</Trans>}>
            <ToggleGroup
              type="single"
              size="xs"
              sliding
              value={flexDir}
              onValueChange={(v) => v && setFlexDir(v)}
            >
              {directionItems.map(({ value, icon: Icon, label }) => (
                <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                  <Icon className="h-3.5 w-3.5" />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </StyleLabel>
          <StyleLabel label={<Trans>Justify</Trans>}>
            <ToggleGroup
              type="single"
              size="xs"
              sliding
              value={justify}
              onValueChange={(v) => v && setJustify(v)}
            >
              {justifyItems.map(({ value, icon: Icon, label }) => (
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
          <StyleLabel label={<Trans>Gap</Trans>}>
            <input
              type="number"
              value={gap}
              onChange={(e) => setGap(Number(e.target.value) || 0)}
              min={0}
              className={cn(
                "h-8 w-full bg-muted/60 rounded-md px-2 text-[12px] tabular-nums outline-none",
                "focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500",
                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
            />
          </StyleLabel>
        </>
      )}
    </Section>
  )
}
