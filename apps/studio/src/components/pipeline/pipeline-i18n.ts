import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import { i18n } from "@lingui/core"

/**
 * Stage label messages keyed by stage slug.
 * Use with useLingui()'s `_` in React components, or `i18n._` outside React.
 */
export const STAGE_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
  book: msg`Book`,
  extract: msg`Extract`,
  sectioning: msg`Sectioning`,
  storyboard: msg`Storyboard`,
  quizzes: msg`Quizzes`,
  captions: msg`Image Captions`,
  glossary: msg`Glossary`,
  toc: msg`Table of Contents`,
  "easy-read": msg`Easy Read`,
  translate: msg`Language`,
  speech: msg`Speech`,
  "sign-language": msg`Sign Language`,
  validation: msg`Validation`,
  preview: msg`Preview`,
  export: msg`Export`,
}

export const STAGE_RUNNING_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
  book: msg`Loading Book...`,
  extract: msg`Extracting...`,
  sectioning: msg`Sectioning Pages...`,
  storyboard: msg`Building Storyboard...`,
  quizzes: msg`Generating Quizzes...`,
  captions: msg`Captioning Images...`,
  glossary: msg`Generating Glossary...`,
  toc: msg`Generating TOC...`,
  "easy-read": msg`Generating Easy Read...`,
  translate: msg`Translating languages...`,
  speech: msg`Generating Speech...`,
  "sign-language": msg`Sign Language`,
  validation: msg`Running Validation...`,
  preview: msg`Building Preview...`,
  export: msg`Exporting...`,
}

export const STAGE_DESCRIPTION_MESSAGES: Record<string, MessageDescriptor> = {
  extract: msg`Extract text and images from each page of the PDF using AI-powered analysis.`,
  sectioning: msg`Structure each page into a content tree of sections and nodes for downstream rendering.`,
  storyboard: msg`Arrange extracted content into a structured storyboard with pages, sections, and layouts.`,
  quizzes: msg`Generate comprehension quizzes and activities based on the book content.`,
  captions: msg`Create descriptive captions for images to improve accessibility.`,
  glossary: msg`Build a glossary of key terms and definitions found in the text.`,
  toc: msg`Generate and customize the table of contents for the book navigation.`,
  "easy-read": msg`Generate and edit Easy Read text blocks for the ADT accessibility toggle.`,
  translate: msg`Translate the book content to output languages.`,
  speech: msg`Generate audio narration for the book content.`,
  "sign-language": msg`Upload and assign sign language videos to book pages.`,
  validation: msg`Run whole-book validation checks and configure accessibility assessment settings.`,
  preview: msg`Package and preview the final ADT web application.`,
}

export const STEP_LABEL_MESSAGES: Record<string, MessageDescriptor> = {
  extract: msg`PDF Extraction`,
  metadata: msg`Metadata`,
  "book-summary": msg`Book Summary`,
  "image-filtering": msg`Image Filtering`,
  "image-segmentation": msg`Image Segmentation`,
  "image-cropping": msg`Image Cropping`,
  "image-meaningfulness": msg`Image Meaningfulness`,
  translation: msg`Translation`,
  "page-sectioning": msg`Page Sectioning`,
  "web-rendering": msg`Web Rendering`,
  "quiz-generation": msg`Quiz Generation`,
  "image-captioning": msg`Image Captioning`,
  glossary: msg`Glossary Generation`,
  "toc-generation": msg`Table of Contents`,
  "text-catalog": msg`Text Catalog`,
  "easy-read": msg`Easy Read`,
  "catalog-translation": msg`Catalog Translation`,
  "image-translation": msg`Image Translation`,
  tts: msg`Speech Generation`,
  "word-timestamps": msg`Word Highlighting`,
  "package-web": msg`Web Package`,
}

/** Resolve a stage label message descriptor to a translated string. Safe to call outside React. */
export function getStageLabelI18n(slug: string): string {
  const descriptor = STAGE_LABEL_MESSAGES[slug]
  return descriptor ? i18n._(descriptor) : slug
}

/** Resolve a stage running label message descriptor to a translated string. Safe to call outside React. */
export function getStageRunningLabelI18n(slug: string): string {
  const descriptor = STAGE_RUNNING_LABEL_MESSAGES[slug]
  return descriptor ? i18n._(descriptor) : slug
}

/** Resolve a stage description message descriptor to a translated string. Safe to call outside React. */
export function getStageDescriptionI18n(slug: string): string | undefined {
  const descriptor = STAGE_DESCRIPTION_MESSAGES[slug]
  return descriptor ? i18n._(descriptor) : undefined
}

/** Resolve a step label message descriptor to a translated string. Safe to call outside React. */
export function getStepLabelI18n(slug: string): string {
  const descriptor = STEP_LABEL_MESSAGES[slug]
  return descriptor ? i18n._(descriptor) : slug
}
