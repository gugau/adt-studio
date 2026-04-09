import type { ReactNode } from "react"
import { useBookRun } from "./use-book-run"

export interface ExportFeatureToggles {
  glossary: boolean
  readAloud: boolean
  quizzes: boolean
  // TODO: Add sign language detection later
  // signLanguage: boolean
}

export interface AvailableExportFeatures {
  glossary: boolean
  readAloud: boolean
  quizzes: boolean
}

export interface AllProjectFeatures {
  // Toggleable features
  toggleable: {
    glossary: boolean
    readAloud: boolean
    quizzes: boolean
  }
  // Present but non-toggleable features
  present: {
    captions: boolean
    toc: boolean
  }
  // Missing accessibility features
  missing: {
    signLanguage: boolean
  }
}

/**
 * Derive which export features are available based on completed pipeline stages.
 * Only shows toggles for features that have been generated in the project.
 */
export function useAvailableExportFeatures(): AvailableExportFeatures {
  const { stageState } = useBookRun()

  return {
    glossary: stageState("glossary") === "done",
    readAloud: stageState("speech") === "done",
    quizzes: stageState("quizzes") === "done",
  }
}

/**
 * Get all features in the project - toggleable, present, and missing.
 * Used to show the complete accessibility picture in export dialog.
 */
export function useAllProjectFeatures(): AllProjectFeatures {
  const { stageState } = useBookRun()

  return {
    toggleable: {
      glossary: stageState("glossary") === "done",
      readAloud: stageState("speech") === "done",
      quizzes: stageState("quizzes") === "done",
    },
    present: {
      captions: stageState("captions") === "done",
      toc: stageState("toc") === "done",
    },
    missing: {
      signLanguage: false, // TODO: Check storage for sign language videos when available
    },
  }
}
