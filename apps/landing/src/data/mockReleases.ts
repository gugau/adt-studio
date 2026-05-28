export type ReleaseSection = {
  heading: string;
  items: string[];
};

export type MockRelease = {
  tag: string;
  name: string;
  codename: string;
  published_at: string;
  hero: {
    src: string;
    alt: string;
  };
  summary: string;
  sections?: ReleaseSection[];
};

export const MOCK_RELEASES: MockRelease[] = [
  {
    tag: "v0.9.0",
    name: "Spectrum and Crystal",
    codename: "Spectrum and Crystal",
    published_at: "2026-05-21T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-spectrum/1280/720",
      alt: "Spectrum and Crystal — abstract light prism rendering",
    },
    summary:
      "Today we're shipping two new hero treatments for storybook covers — Spectrum, a soft prismatic gradient, and Crystal, a faceted glass effect that bends behind the title. Both render at full resolution in every exported bundle, and they pair with the new accent-aware palette so they always match the book's identity.",
    sections: [
      {
        heading: "Added",
        items: [
          "Spectrum and Crystal cover treatments, available across every layout template",
          "Per-book accent palette inferred from the first illustration, used to tint UI chrome",
          "Search-everywhere palette opens from anywhere with ⌘K and jumps to pages, sections, and chapters",
        ],
      },
      {
        heading: "Improved",
        items: [
          "Cover renderer is now GPU-accelerated, cutting preview time on a 200-page book from 6s to 0.8s",
          "Pipeline progress UI now streams stage events in real time instead of polling every second",
          "Markdown release notes render with proper heading hierarchy and link previews",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Fixed a bug where /Matte un-matting on PDF images produced washed-out tones",
          "Restored the activity Submit button in the storyboard embed preview",
          "Fixed missing tw-animate-css dependency in the server runtime installation",
        ],
      },
    ],
  },
  {
    tag: "v0.8.0",
    name: "CMS 3.0",
    codename: "CMS 3.0",
    published_at: "2026-04-09T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-cms/1280/720",
      alt: "CMS 3.0 — colorful gradient panel layout",
    },
    summary:
      "Project services in the CMS get a fresh coat of paint in this release. Manage long-running pipelines, track per-book regenerations, and rerun a single stage without rebuilding the whole book — all from a redesigned project view that finally feels like one surface instead of three.",
    sections: [
      {
        heading: "Added",
        items: [
          "Project home redesign with a unified pipeline graph and step inspector",
          "Per-stage retry that respects the LLM cache so unchanged steps stay free",
          "Bulk import for PDFs — drag a folder, get a queue",
        ],
      },
      {
        heading: "Improved",
        items: [
          "Cache hit rates surfaced inline on every step so reruns are obvious",
          "Cost summary now breaks out tokens by provider and shows the cached portion",
        ],
      },
    ],
  },
  {
    tag: "v0.7.0",
    name: "Logo Shaders",
    codename: "Logo Shaders",
    published_at: "2026-03-04T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-shaders/1280/720",
      alt: "Logo Shaders — chrome and glass logo treatments",
    },
    summary:
      "Introducing Logo Shaders — a new look for ADT Studio. Smaller, calmer, more accessible, and quieter when you don't need it. Built around a single accent token that flows everywhere from the sidebar to the export bundle, the new chrome makes long sessions feel less heavy without giving up any density.",
  },
  {
    tag: "v0.6.0",
    name: "DSS 2.0",
    codename: "DSS 2.0",
    published_at: "2026-02-14T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-dss/1280/720",
      alt: "DSS 2.0 — design system showcase grid",
    },
    summary:
      "The DSS overhaul ships with a completely redesigned token system, bringing huge collection fields and more density. The whole token tree is now navigable side-by-side, with editing inline on hover. Pipelines you used to assemble by hand now compose from quick copy-and-paste blocks. Statuses, triggers, references, images, icons, and colors now all live in the same field map, so the same authoring interface drives every type of step. The catch-all import block from the legacy site stays around — but now it deprecates cleanly, and your existing books migrate in one click.",
    sections: [
      {
        heading: "Added",
        items: [
          "Nested token editing across all DSS field types",
          "Inline status icons for every step including pending and queued states",
          "Embed support for HTML5 widgets via the new media block",
          "Locale-aware dates everywhere in the editor",
        ],
      },
      {
        heading: "Improved",
        items: [
          "Improved color swatch contrast and bulk actions",
          "Adjusted parent rendering with reflow filters",
          "Improved keyboard navigation across the CMS",
          "Improved field handling with text overflow tightening",
          "Improved the field overlay layout and fades",
          "Improved clarity of CMS error messages",
          "Improved styling of fields in the editors",
          "Improved tilt menu on dark and dim fields",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Fixed text bulk editing on multi-line fields",
          "Fixed truncation behavior on lossy media",
          "Fixed missing keyboard event handler in autosave",
          "Fixed indexing failure in the sub-bag for low ranks",
        ],
      },
    ],
  },
  {
    tag: "v0.5.0",
    name: "Aura Shader",
    codename: "Aura Shader",
    published_at: "2026-01-08T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-aura/1280/720",
      alt: "Aura Shader — vivid holographic gradient",
    },
    summary:
      "Introducing the Aura Shader — a vivid, holographic, light-rippled cover treatment for stories that need a little extra. Built on top of the new shader runtime, Aura ships with three presets out of the box and grows from there. Watch the video for a deep dive into how it works under the hood.",
  },
  {
    tag: "v0.4.0",
    name: "Auto Translate",
    codename: "Auto Translate",
    published_at: "2025-12-12T10:00:00Z",
    hero: {
      src: "https://picsum.photos/seed/adt-translate/1280/720",
      alt: "Auto Translate — multilingual book cover stack",
    },
    summary:
      "Auto Translate ships today. One toggle, every supported locale, every page — including alt text, sidebars, and the cover. Translations stream alongside the original content so you can review side-by-side, and every string lands in the cache so the second run is free.",
  },
];

export function formatRelativeApprox(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const day = 86_400_000;
  const month = 30 * day;
  const year = 365 * day;
  if (diff < month) return "Last month";
  if (diff < 2 * month) return "1 month ago";
  if (diff < year) return `${Math.round(diff / month)} months ago`;
  const years = Math.round(diff / year);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
