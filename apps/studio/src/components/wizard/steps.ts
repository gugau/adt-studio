// TODO: Add translations and define better descriptions for each step
import type { ComponentType } from "react"
import type { WizardFormValues } from "./wizardForm"
import { Step1 } from "./step1BasicInfo"
import { isStep1BasicInfoValid } from "./step1BasicInfo/projectLabelSchema"
import { Step2 } from "./step2LayoutOptions"
// import { Step3 } from "./steps/Step3"
// import { Step4 } from "./steps/Step4"

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
  // {
  //   title: "Image Processing",
  //   description: "Configure image processing settings",
  //   component: Step3,
  //   isValid: (v) => v.outputLanguages.length > 0,
  // },
  // {
  //   title: "Filters",
  //   description: "Configure filters for your configuration",
  //   component: Step4,
  //   isValid: (v) => v.layoutType !== "",
  // },
]
