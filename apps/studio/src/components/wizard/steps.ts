// TODO: Add translations and define better descriptions for each step
import type { ComponentType } from "react"
import type { WizardFormValues } from "./wizardForm"
import { isStep1BasicInfoValid } from "./step1BasicInfo/projectLabelSchema"
import { Step1 } from "./step1BasicInfo"
import { Step2 } from "./step2LayoutOptions"
import { Step3 } from "./step3ImageProcessing"

export interface WizardStepValidationContext {
  existingBookLabels?: readonly string[]
}

export interface StepDef {
  title: string
  description: string
  component: ComponentType
  isValid: (values: WizardFormValues, context?: WizardStepValidationContext) => boolean
}

export const STEPS: StepDef[] = [
  {
    title: "Basic Information",
    description: "Configure basic document information and file paths",
    component: Step1,
    isValid: (v, ctx) =>
      isStep1BasicInfoValid(v, ctx?.existingBookLabels ?? []),
  },
  {
    title: "Visual Layout",
    description: "Choose how the content should be formatted.",
    component: Step2,
    isValid: (v) =>
      v.renderStrategy !== "" &&
      v.pageGrouping !== "" &&
      v.sectioningMode !== "",
  },
  {
    title: "Image Processing",
    description:
      "Control LLM cropping and segmentation for extracted images — matching extract-stage image filters.",
    component: Step3,
    isValid: (v) => {
      if (!v.imageSegmentation) return true
      const t = v.segmentationMinSide.trim()
      if (!t) return true
      const n = Number(t)
      return Number.isInteger(n) && n >= 0
    },
  },
]
