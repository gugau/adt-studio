import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import { i18n } from "@lingui/core"

const TEXT_TYPE_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
  heading: msg`Heading`,
  text: msg`Text`,
  math: msg`Math`,
  activity_instruction: msg`Activity Instruction`,
  activity_question: msg`Activity Question`,
  activity_fill_in_the_blank: msg`Fill in the Blank`,
  caption: msg`Caption`,
  label: msg`Label`,
  activity_number: msg`Activity Number`,
  book_metadata: msg`Book Metadata`,
  page_number: msg`Page Number`,
  header: msg`Header`,
  footer: msg`Footer`,
  quote: msg`Quote`,
}

const IMAGE_TYPE_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
}

const TEXT_GROUP_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
  activity: msg`Activity`,
  activity_option: msg`Activity Option`,
  image: msg`Image`,
  group: msg`Group`,
  list: msg`List`,
  list_item: msg`List Item`,
  panel: msg`Panel`,
  sidebar: msg`Sidebar`,
  table: msg`Table`,
  table_row: msg`Table Row`,
  table_cell: msg`Table Cell`,
  preformatted: msg`Preformatted`,
}

export function getTextTypeLabel(type: string): string {
  const descriptor = TEXT_TYPE_LABEL_MESSAGES[type]
  if (descriptor) return i18n._(descriptor)
  return type.replace(/_/g, " ")
}

export function getImageTypeLabel(type: string): string {
  const descriptor = IMAGE_TYPE_LABEL_MESSAGES[type]
  if (descriptor) return i18n._(descriptor)
  return type.replace(/_/g, " ")
}

export function getTextGroupLabel(groupType: string): string {
  const descriptor = TEXT_GROUP_LABEL_MESSAGES[groupType]
  if (descriptor) return i18n._(descriptor)
  return groupType.replace(/_/g, " ")
}
