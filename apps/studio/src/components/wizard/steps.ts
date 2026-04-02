import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import type { ComponentType } from "react"
import type { WizardFormValues } from "./wizardForm"
import { isStep1BasicInfoValid } from "./step1BasicInfo/projectLabelSchema"
import { Step1 } from "./step1BasicInfo"
import { Step2 } from "./step2LayoutOptions"
import { Step3 } from "./step3ImageProcessing"
import { Step4 } from "./step4Languages"
import { Step5 } from "./step5Styleguide"

export interface WizardStepValidationContext {
  existingBookLabels?: readonly string[]
}

export interface StepDef {
  title: MessageDescriptor
  description: MessageDescriptor
  component: ComponentType
  isValid: (values: WizardFormValues, context?: WizardStepValidationContext) => boolean
}

export const STEPS: StepDef[] = [
  {
    title: msg`Basic Information`,
    description: msg`Configure basic document information and file paths`,
    component: Step1,
    isValid: (v, ctx) =>
      isStep1BasicInfoValid(v, ctx?.existingBookLabels ?? []),
  },
  {
    title: msg`Visual Layout`,
    description: msg`Choose how the content should be formatted.`,
    component: Step2,
    isValid: (v) =>
      v.renderStrategy !== "" &&
      v.pageGrouping !== "" &&
      v.sectioningMode !== "",
  },
  {
    title: msg`Image Processing`,
    description: msg`Control LLM cropping and segmentation for extracted images - matching extract-stage image filters.`,
    component: Step3,
    isValid: (v) => {
      if (!v.imageSegmentation) return true
      const t = v.segmentationMinSide.trim()
      if (!t) return true
      const n = Number(t)
      return Number.isInteger(n) && n >= 0
    },
  },
  {
    title: msg`Languages`,
    description: msg`Set the editing language and choose output languages for the book.`,
    component: Step4,
    isValid: () => true,
  },
  {
    title: msg`Style Guide`,
    description: msg`Choose a style guide to control the look and feel of the generated pages.`,
    component: Step5,
    isValid: () => true,
  },
]
