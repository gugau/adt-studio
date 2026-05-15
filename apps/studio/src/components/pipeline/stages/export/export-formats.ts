import { msg } from "@lingui/core/macro"
import type { LucideIcon } from "lucide-react"
import { FileDown, Globe, GraduationCap } from "lucide-react"

export type ExportFormat = "project" | "webpub" | "scorm" | "adt"

export interface FormatConfig {
  icon: LucideIcon
  label: string
  description: string
  textColor: string
  bgLight: string
  borderColor: string
  buttonClass: string
  badge?: string
}

/**
 * Static export format configuration — single source of truth for all export UI
 */
export const EXPORT_FORMAT_CONFIG: Record<ExportFormat, Omit<FormatConfig, "label" | "description" | "badge">> = {
  project: {
    icon: FileDown,
    textColor: "text-emerald-600",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  adt: {
    icon: Globe,
    textColor: "text-sky-600",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    buttonClass: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  scorm: {
    icon: GraduationCap,
    textColor: "text-amber-600",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  webpub: {
    icon: Globe,
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
}

/**
 * Build complete format config with translated labels and descriptions.
 * Must be called at runtime with the i18n translator.
 */
export function buildExportFormatConfig(t: (msg: any) => string): Record<ExportFormat, FormatConfig> {
  return {
    project: {
      ...EXPORT_FORMAT_CONFIG.project,
      label: t(msg`Project Archive`),
      description: t(msg`Back up or transfer the full project including the database, PDF, and all pipeline outputs.`),
    },
    adt: {
      ...EXPORT_FORMAT_CONFIG.adt,
      label: t(msg`Web Export`),
      description: t(msg`Full ADT bundle — HTML pages, images, audio, activities, and the compiled web app.`),
    },
    scorm: {
      ...EXPORT_FORMAT_CONFIG.scorm,
      label: t(msg`SCORM Export`),
      description: t(msg`Upload to an LMS as a SCORM 1.2 package with completion tracking and offline support.`),
    },
    webpub: {
      ...EXPORT_FORMAT_CONFIG.webpub,
      label: t(msg`WebPub Export`),
      description: t(msg`Readium Web Publication format for standards-based digital distribution platforms.`),
      badge: t(msg`Beta`),
    },
  }
}
