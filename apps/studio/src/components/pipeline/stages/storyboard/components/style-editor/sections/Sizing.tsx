/* eslint-disable lingui/no-unlocalized-strings -- option-key strings are internal field discriminants */

import { Trans, useLingui } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { UnitInput, type UnitValue } from "../controls/UnitInput"
import { AddFieldButton } from "../controls/AddFieldButton"
import { useElementContext } from "../element-context"
import {
  useDynamicFields,
  type OptionalFieldDef,
} from "../use-dynamic-fields"
import {
  widthClassMap,
  heightClassMap,
  minWidthClassMap,
  minHeightClassMap,
  maxWidthClassMap,
  maxHeightClassMap,
} from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const AUTO: UnitValue = { value: "auto", unit: "auto" }
const NONE: UnitValue = { value: "none", unit: "none" }

const DIM_UNITS = ["px", "%", "auto"] as const
const MAX_UNITS = ["px", "%", "none"] as const

type SizingOptional = "minWidth" | "minHeight" | "maxWidth" | "maxHeight"

const OPTIONALS: ReadonlyArray<OptionalFieldDef<SizingOptional>> = [
  { key: "minWidth", classMatch: /(?:^|:)min-w-/ },
  { key: "minHeight", classMatch: /(?:^|:)min-h-/ },
  { key: "maxWidth", classMatch: /(?:^|:)max-w-/ },
  { key: "maxHeight", classMatch: /(?:^|:)max-h-/ },
]

export function SizingSection() {
  const { t } = useLingui()
  const { classes, dataId } = useElementContext()
  const { has, enable } = useDynamicFields(OPTIONALS, classes, dataId)

  const { value: width, setValue: setWidth } = useElementStyles(
    widthClassMap,
    AUTO
  )
  const { value: height, setValue: setHeight } = useElementStyles(
    heightClassMap,
    AUTO
  )
  const { value: minWidth, setValue: setMinWidth } = useElementStyles(
    minWidthClassMap,
    AUTO
  )
  const { value: minHeight, setValue: setMinHeight } = useElementStyles(
    minHeightClassMap,
    AUTO
  )
  const { value: maxWidth, setValue: setMaxWidth } = useElementStyles(
    maxWidthClassMap,
    NONE
  )
  const { value: maxHeight, setValue: setMaxHeight } = useElementStyles(
    maxHeightClassMap,
    NONE
  )

  const addFieldOptions = [
    { value: "minWidth" as const, label: <Trans>Min width</Trans> },
    { value: "minHeight" as const, label: <Trans>Min height</Trans> },
    { value: "maxWidth" as const, label: <Trans>Max width</Trans> },
    { value: "maxHeight" as const, label: <Trans>Max height</Trans> },
  ].filter((o) => !has(o.value))

  return (
    <Section
      title={<Trans>Sizing</Trans>}
      actions={
        <AddFieldButton
          options={addFieldOptions}
          onSelect={enable}
          ariaLabel={t`Add sizing field`}
        />
      }
    >
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
    </Section>
  )
}
