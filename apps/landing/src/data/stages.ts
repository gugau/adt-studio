import {
  AudioLines,
  BookOpen,
  Eye,
  FileText,
  HelpCircle,
  Image,
  Languages,
  LayoutGrid,
  List,
  type LucideIcon,
} from "lucide-react";

export type Stage = {
  slug: string;
  label: string;
  icon: LucideIcon;
  hex: string;
};

export const STAGES: Stage[] = [
  { slug: "extract", label: "Extract", icon: FileText, hex: "#2563eb" },
  { slug: "storyboard", label: "Storyboard", icon: LayoutGrid, hex: "#7c3aed" },
  { slug: "quizzes", label: "Quizzes", icon: HelpCircle, hex: "#ea580c" },
  { slug: "captions", label: "Captions", icon: Image, hex: "#0d9488" },
  { slug: "glossary", label: "Glossary", icon: BookOpen, hex: "#65a30d" },
  { slug: "toc", label: "Contents", icon: List, hex: "#d97706" },
  { slug: "translate", label: "Language", icon: Languages, hex: "#db2777" },
  { slug: "speech", label: "Speech", icon: AudioLines, hex: "#e11d48" },
  { slug: "preview", label: "Preview", icon: Eye, hex: "#4b5563" },
];
