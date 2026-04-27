import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Select, type SelectOption } from "../controls/Select"
import type { StyleEditorElementProps } from "../ElementActions"

interface TextRoleSectionProps {
  dataId: string
  elementProps: StyleEditorElementProps | null
}

/**
 * Compact "Role" select shown above the property accordion when the selected
 * element is a text leaf. Lets the user quickly switch between heading,
 * paragraph, caption, etc.
 */
export function TextRoleSection({ dataId, elementProps }: TextRoleSectionProps) {
  if (!elementProps) return null
  const { textType, textTypes, onChangeTextType } = elementProps
  if (!textTypes || !onChangeTextType) return null

  const options: ReadonlyArray<SelectOption<string>> = Object.keys(textTypes).map(
    (key) => ({ value: key, label: humanizeRole(key) })
  )

  return (
    <section className="border-b px-3 py-3">
      <StyleLabel label={<Trans>Role</Trans>}>
        <Select
          value={textType ?? ""}
          onChange={(v) => onChangeTextType(dataId, v)}
          options={options}
        />
      </StyleLabel>
    </section>
  )
}

function humanizeRole(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
