import type { ReactNode } from "react"
import { useBookRun } from "./use-book-run"
import { useSignLanguageVideos } from "./use-sign-language-videos"

export interface ExportFeatureToggles {
  glossary: boolean
  readAloud: boolean
  quizzes: boolean
  signLanguage: boolean
  languages?: string[]
}

export interface AvailableExportFeatures {
  glossary: boolean
  readAloud: boolean
  quizzes: boolean
  signLanguage: boolean
}

export interface AllProjectFeatures {
  toggleable: {
    glossary: boolean
    readAloud: boolean
    quizzes: boolean
    signLanguage: boolean
  }
  present: {
    captions: boolean
    toc: boolean
  }
}

/**
 * Derive which export features are available based on completed pipeline stages.
 * Only shows toggles for features that have been generated in the project.
 */
export function useAvailableExportFeatures(bookLabel: string): AvailableExportFeatures {
  const { stageState } = useBookRun()
  const { data: signLanguageData } = useSignLanguageVideos(bookLabel)
  const hasAssignedVideos = signLanguageData?.videos?.some((v) => v.sectionId !== null) ?? false

  return {
    glossary: stageState("glossary") === "done",
    readAloud: stageState("speech") === "done",
    quizzes: stageState("quizzes") === "done",
    signLanguage: hasAssignedVideos,
  }
}

/**
 * Get all features in the project - toggleable, present, and missing.
 * Used to show the complete accessibility picture in export dialog.
 */
export function useAllProjectFeatures(bookLabel: string): AllProjectFeatures {
  const { stageState } = useBookRun()
  const { data: signLanguageData } = useSignLanguageVideos(bookLabel)
  const hasAssignedVideos = signLanguageData?.videos?.some((v) => v.sectionId !== null) ?? false

  return {
    toggleable: {
      glossary: stageState("glossary") === "done",
      readAloud: stageState("speech") === "done",
      quizzes: stageState("quizzes") === "done",
      signLanguage: hasAssignedVideos,
    },
    present: {
      captions: stageState("captions") === "done",
      toc: stageState("toc") === "done",
    },
  }
}
