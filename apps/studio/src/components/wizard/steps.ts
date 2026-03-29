// TODO: Add translations and define better descriptions for each step
import type { ComponentType } from "react"
import type { WizardFormValues } from "./wizardForm"
import { Step1 } from "./step1BasicInfo"
// import { Step2 } from "./steps/Step2"
// import { Step3 } from "./steps/Step3"
// import { Step4 } from "./steps/Step4"

export interface StepDef {
  title: string
  description: string
  component: ComponentType
  isValid: (values: WizardFormValues) => boolean
}

export const STEPS: StepDef[] = [
  {
    title: "Basic Information",
    description: "Configure basic document information and file paths",
    component: Step1,
    isValid: (v) => !!v.file && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v.label),
  },
  // {
  //   title: "Layout Options",
  //   description: "Configure layout options for your document",
  //   component: Step2,
  //   isValid: (v) => !!v.file,
  // },
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
// TODO: get the presets from @step0preset/constants.ts
export const PRESET_DEFAULTS: Record<string, Partial<WizardFormValues>> = {
  textbook:  { layoutType: "textbook",  outputLanguages: ["en"] },
  storybook: { layoutType: "storybook", outputLanguages: ["en"] },
  reference: { layoutType: "reference", outputLanguages: ["en"] },
  custom:    {},
}
