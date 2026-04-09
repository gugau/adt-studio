import { cn } from "@/lib/utils"
import type { SVGProps } from "react"

/** Wireframe preview for the Fixed Layout preset — full-spread illustration with text overlaid on the page image. */
export function FixedLayoutWireframePreview({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 260 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id="pbSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ec4899" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ec4899" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="pbSpineL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="black" stopOpacity="0" />
          <stop offset="1" stopColor="black" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="pbSpineR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="black" stopOpacity="0.08" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <clipPath id="pbLeftClip">
          <rect x="13" y="16" width="113" height="168" rx="4" />
        </clipPath>
        <clipPath id="pbRightClip">
          <rect x="134" y="16" width="113" height="168" rx="4" />
        </clipPath>
      </defs>

      {/* Book drop shadow */}
      <rect x="18" y="22" width="224" height="168" rx="5" fill="black" fillOpacity="0.07" />

      {/* Left page */}
      <rect x="13" y="16" width="113" height="168" rx="4" fill="white" stroke="#e5e5e5" strokeWidth="1" />

      {/* Right page */}
      <rect x="134" y="16" width="113" height="168" rx="4" fill="white" stroke="#e5e5e5" strokeWidth="1" />

      {/* ── Full-bleed illustration across both pages ─────────────── */}

      {/* Sky (left) */}
      <g clipPath="url(#pbLeftClip)">
        <rect x="13" y="16" width="113" height="112" fill="url(#pbSky)" />
        {/* Sun */}
        <circle cx="38" cy="44" r="11" fill="#ec4899" fillOpacity="0.28" />
        <circle cx="38" cy="44" r="6" fill="#ec4899" fillOpacity="0.45" />
        {/* Clouds */}
        <ellipse cx="72" cy="38" rx="12" ry="5" fill="white" />
        <ellipse cx="82" cy="35" rx="9" ry="4.5" fill="white" />
        {/* Distant hills */}
        <path d="M13 110 Q44 88 78 104 T126 100 L126 128 L13 128 Z" fill="#ec4899" fillOpacity="0.12" />
        {/* Foreground ground */}
        <path d="M13 128 Q45 124 78 130 T126 132 L126 184 L13 184 Z" fill="#ec4899" fillOpacity="0.18" />
        {/* Tree */}
        <rect x="96" y="120" width="5" height="24" rx="1.5" fill="#ec4899" fillOpacity="0.4" />
        <ellipse cx="98.5" cy="115" rx="11" ry="13" fill="#ec4899" fillOpacity="0.32" />
        {/* Small critter (bunny-ish) */}
        <ellipse cx="46" cy="148" rx="8" ry="6" fill="#ec4899" fillOpacity="0.55" />
        <circle cx="52" cy="143" r="4.5" fill="#ec4899" fillOpacity="0.6" />
        <rect x="48" y="134" width="1.8" height="8" rx="0.9" fill="#ec4899" fillOpacity="0.6" />
        <rect x="51.5" y="134" width="1.8" height="8" rx="0.9" fill="#ec4899" fillOpacity="0.6" />
      </g>

      {/* Sky (right) — continues the spread */}
      <g clipPath="url(#pbRightClip)">
        <rect x="134" y="16" width="113" height="112" fill="url(#pbSky)" />
        {/* Clouds */}
        <ellipse cx="168" cy="32" rx="11" ry="5" fill="white" />
        <ellipse cx="158" cy="30" rx="7" ry="4" fill="white" />
        <ellipse cx="222" cy="46" rx="10" ry="4.5" fill="white" />
        {/* Bird silhouettes */}
        <path d="M198 54 q3 -3 6 0 q3 -3 6 0" stroke="#ec4899" strokeOpacity="0.55" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M218 62 q2.5 -2.5 5 0 q2.5 -2.5 5 0" stroke="#ec4899" strokeOpacity="0.45" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* Distant hills continue */}
        <path d="M134 104 Q170 86 206 100 T247 108 L247 128 L134 128 Z" fill="#ec4899" fillOpacity="0.12" />
        {/* Foreground ground continues */}
        <path d="M134 132 Q170 126 206 130 T247 134 L247 184 L134 184 Z" fill="#ec4899" fillOpacity="0.18" />
        {/* Flowers */}
        <circle cx="156" cy="160" r="2" fill="#ec4899" fillOpacity="0.6" />
        <circle cx="184" cy="166" r="2" fill="#ec4899" fillOpacity="0.55" />
        <circle cx="226" cy="158" r="2" fill="#ec4899" fillOpacity="0.55" />
        {/* Butterfly */}
        <ellipse cx="210" cy="132" rx="3" ry="2" fill="#ec4899" fillOpacity="0.5" />
        <ellipse cx="215" cy="132" rx="3" ry="2" fill="#ec4899" fillOpacity="0.5" />
      </g>

      {/* Spine (on top of illustration for depth) */}
      <rect x="124" y="16" width="12" height="168" fill="#f5f5f5" fillOpacity="0.85" />
      <line x1="130" y1="16" x2="130" y2="184" stroke="#e0e0e0" strokeWidth="1" />
      <rect x="112" y="16" width="12" height="168" fill="url(#pbSpineL)" clipPath="url(#pbLeftClip)" />
      <rect x="134" y="16" width="12" height="168" fill="url(#pbSpineR)" clipPath="url(#pbRightClip)" />

      {/* ── Text overlaid on the illustration (the defining feature) ─ */}
      {/* Left page text */}
      <rect x="22" y="56" width="58" height="4.5" rx="1.5" fill="white" />
      <rect x="22" y="56" width="58" height="4.5" rx="1.5" fill="#6b7280" fillOpacity="0.55" />
      <rect x="22" y="66" width="48" height="4.5" rx="1.5" fill="white" />
      <rect x="22" y="66" width="48" height="4.5" rx="1.5" fill="#6b7280" fillOpacity="0.5" />

      {/* Right page text */}
      <rect x="152" y="70" width="62" height="4.5" rx="1.5" fill="white" />
      <rect x="152" y="70" width="62" height="4.5" rx="1.5" fill="#6b7280" fillOpacity="0.55" />
      <rect x="152" y="80" width="54" height="4.5" rx="1.5" fill="white" />
      <rect x="152" y="80" width="54" height="4.5" rx="1.5" fill="#6b7280" fillOpacity="0.5" />
      <rect x="152" y="90" width="44" height="4.5" rx="1.5" fill="white" />
      <rect x="152" y="90" width="44" height="4.5" rx="1.5" fill="#6b7280" fillOpacity="0.5" />
    </svg>
  )
}
