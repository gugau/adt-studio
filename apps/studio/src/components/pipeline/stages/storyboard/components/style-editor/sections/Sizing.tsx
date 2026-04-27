/* eslint-disable lingui/no-unlocalized-strings -- option-key strings are internal field discriminants */

import { useState } from "react"
import { ArrowLeftRight, Maximize2 } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { UnitInput, type UnitValue } from "../controls/UnitInput"
import { AddFieldRow } from "../controls/AddFieldRow"
import { useElementContext } from "../element-context"
import {
  useDynamicFields,
  type OptionalFieldDef,
} from "../use-dynamic-fields"

const AUTO: UnitValue = { value: "auto", unit: "auto" }
const NONE: UnitValue = { value: "none", unit: "none" }

const DIM_UNITS = ["px", "%", "auto"] as const
const MAX_UNITS = ["px", "%", "none"] as const

type SizingOptional = "minWidth" | "minHeight" | "maxWidth" | "maxHeight"

const OPTIONALS: ReadonlyArray<OptionalFieldDef<SizingOptional>> = [
  // Tailwind: min-w-*, min-h-*, max-w-*, max-h-*
  // (with optional breakpoint prefix like `max-md:` / `max-sm:`)
  { key: "minWidth", classMatch: /(?:^|:)min-w-/ },
  { key: "minHeight", classMatch: /(?:^|:)min-h-/ },
  { key: "maxWidth", classMatch: /(?:^|:)max-w-/ },
  { key: "maxHeight", classMatch: /(?:^|:)max-h-/ },
]

export function SizingSection() {
  const { classes, dataId } = useElementContext()
  const { has, enable } = useDynamicFields(OPTIONALS, classes, dataId)

  const [width, setWidth] = useState<UnitValue>(AUTO)
  const [height, setHeight] = useState<UnitValue>(AUTO)
  const [minWidth, setMinWidth] = useState<UnitValue>(AUTO)
  const [minHeight, setMinHeight] = useState<UnitValue>(AUTO)
  const [maxWidth, setMaxWidth] = useState<UnitValue>(NONE)
  const [maxHeight, setMaxHeight] = useState<UnitValue>(NONE)

  const addFieldOptions = [
    { value: "minWidth" as const, label: <Trans>Min width</Trans> },
    { value: "minHeight" as const, label: <Trans>Min height</Trans> },
    { value: "maxWidth" as const, label: <Trans>Max width</Trans> },
    { value: "maxHeight" as const, label: <Trans>Max height</Trans> },
  ].filter((o) => !has(o.value))

  return (
    <Section value="sizing" title={<Trans>Sizing</Trans>} icon={Maximize2}>
      <StyleLabel label={<Trans>Width</Trans>}>
        <UnitInput value={width} onChange={setWidth} units={DIM_UNITS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Height</Trans>}>
        <UnitInput value={height} onChange={setHeight} units={DIM_UNITS} />
      </StyleLabel>
      {has("minWidth") ? (
        <StyleLabel label={<Trans>Min width</Trans>}>
          <UnitInput value={minWidth} onChange={setMinWidth} units={DIM_UNITS} />
        </StyleLabel>
      ) : null}
      {has("minHeight") ? (
        <StyleLabel label={<Trans>Min height</Trans>}>
          <UnitInput value={minHeight} onChange={setMinHeight} units={DIM_UNITS} />
        </StyleLabel>
      ) : null}
      {has("maxWidth") ? (
        <StyleLabel label={<Trans>Max width</Trans>}>
          <UnitInput value={maxWidth} onChange={setMaxWidth} units={MAX_UNITS} />
        </StyleLabel>
      ) : null}
      {has("maxHeight") ? (
        <StyleLabel label={<Trans>Max height</Trans>}>
          <UnitInput value={maxHeight} onChange={setMaxHeight} units={MAX_UNITS} />
        </StyleLabel>
      ) : null}
      <AddFieldRow
        label={<Trans>Min Max</Trans>}
        icon={ArrowLeftRight}
        options={addFieldOptions}
        onSelect={enable}
      />
    </Section>
  )
}
