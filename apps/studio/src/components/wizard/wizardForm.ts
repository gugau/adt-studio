import { createFormHook, createFormHookContexts } from "@tanstack/react-form"
import type {
  RenderStrategyId,
  WizardPageGrouping,
  WizardSectioningMode,
} from "./constants"

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

export const { useAppForm, useTypedAppFormContext } = createFormHook({
  fieldComponents: {},
  formComponents: {},
  fieldContext,
  formContext,
})

export const defaultWizardValues = {
  selectedPreset: null as string | null,
  label: "",
  file: null as File | null,
  startPage: "",
  endPage: "",
  outputLanguages: [] as string[],
  renderStrategy: "" as RenderStrategyId | "",
  layoutType: "",
  pageGrouping: "" as WizardPageGrouping,
  sectioningMode: "" as WizardSectioningMode,
  imageCropping: false,
  imageSegmentation: true,
  segmentationMinSide: "",
  imageFilterMinSide: 100,
  imageFilterMaxSide: 5000,
  editingLanguage: "",
  styleguide: "",
}

export type WizardFormValues = typeof defaultWizardValues

export function useWizardForm() {
  return useTypedAppFormContext({ defaultValues: defaultWizardValues })
}

