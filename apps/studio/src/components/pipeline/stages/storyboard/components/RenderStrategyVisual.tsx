import type { ReactNode } from "react"
import { Trans } from "@lingui/react/macro"

export function RenderStrategyVisual() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ThumbnailFrame label={<Trans>One Column</Trans>}>
        <SingleColumnThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>AI Generated</Trans>}>
        <AiGeneratedThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>Dynamic Overlay</Trans>}>
        <DynamicOverlayThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>Two Column</Trans>}>
        <TwoColumnStoryThumb />
      </ThumbnailFrame>
    </div>
  )
}

function ThumbnailFrame({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-sm border border-[#e5e5e5] bg-white p-2 shadow-sm">
        {children}
      </div>
      <span className="text-[10px] font-medium leading-none text-[#525252]">
        {label}
      </span>
    </div>
  )
}

function SingleColumnThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-[3px]">
      <p className="text-[8px] font-semibold leading-tight text-neutral-800">
        <Trans>The Water Cycle</Trans>
      </p>
      <p className="text-[5.5px] uppercase tracking-wider leading-none text-neutral-400">
        <Trans>Chapter 3</Trans>
      </p>
      <div className="mt-[2px] flex h-7 w-full items-center justify-center overflow-hidden rounded-[1px] bg-gradient-to-br from-violet-200 via-violet-100 to-white">
        <div className="h-2 w-2 rounded-full bg-violet-300/70" />
      </div>
      <p className="mt-[1px] text-justify text-[5.5px] leading-[1.4] text-neutral-500">
        <Trans>
          Water moves continuously through evaporation, condensation, and
          precipitation. Most vapor returns to the oceans, while some falls
          on land as rain or snow before flowing back to the sea.
        </Trans>
      </p>
    </div>
  )
}

function AiGeneratedThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <p className="text-[8px] font-semibold leading-tight text-neutral-800">
        <Trans>Volcanic Origins</Trans>
      </p>
      <div className="grid grid-cols-[1fr_1.1fr] gap-1">
        <p className="text-[5.5px] leading-[1.4] text-neutral-500">
          <Trans>
            Beneath Earth's crust, molten rock builds pressure over
            millennia until it finds a path to the surface.
          </Trans>
        </p>
        <div className="relative h-9 overflow-hidden rounded-[1px] bg-gradient-to-br from-violet-300 via-violet-400 to-violet-600">
          <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/70" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
      <div className="rounded-[1px] border-l-2 border-violet-400 bg-violet-50/80 px-1 py-[2px]">
        <p className="text-[6px] font-medium italic leading-[1.3] text-violet-700">
          <Trans>"A landscape forged by fire."</Trans>
        </p>
      </div>
      <p className="text-[5.5px] leading-[1.4] text-neutral-500">
        <Trans>Eruptions reshape entire regions in mere days.</Trans>
      </p>
    </div>
  )
}

function DynamicOverlayThumb() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1px]">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-500 to-violet-300" />
      <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white/60 blur-[1px]" />
      <div className="absolute left-2 top-3 h-[1px] w-[1px] rounded-full bg-white" />
      <div className="absolute right-3 top-2 h-[1px] w-[1px] rounded-full bg-white/80" />
      <div className="absolute left-3 top-5 h-[1px] w-[1px] rounded-full bg-white/70" />
      <div className="absolute inset-x-0 top-1/2 h-1/2 bg-gradient-to-b from-transparent to-black/25" />
      <div className="absolute inset-x-1.5 bottom-1.5 rounded-[2px] border border-white/40 bg-white/85 px-1.5 py-[5px] shadow-sm backdrop-blur-[1px]">
        <p className="text-[7px] font-semibold leading-tight text-neutral-800">
          <Trans>Among the Stars</Trans>
        </p>
        <p className="mt-[2px] text-[5.5px] leading-[1.35] text-neutral-500">
          <Trans>First images from the deep-field telescope.</Trans>
        </p>
      </div>
    </div>
  )
}

function TwoColumnStoryThumb() {
  return (
    <div className="grid h-full w-full grid-cols-[1.05fr_1fr] gap-1">
      <div className="relative overflow-hidden rounded-[1px] bg-gradient-to-b from-violet-200 via-violet-100 to-violet-50">
        <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-violet-400/80" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-violet-500/40 via-violet-300/25 to-transparent" />
        <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-violet-500/70" />
        <div className="absolute bottom-1.5 left-2.5 h-2 w-1 rounded-full bg-violet-600/55" />
        <div className="absolute bottom-[3px] right-2 h-1.5 w-[3px] rounded-full bg-violet-700/55" />
      </div>
      <div className="flex flex-col gap-[3px] pt-[2px]">
        <p className="text-[7.5px] font-semibold leading-tight text-neutral-800">
          <Trans>The Lost Forest</Trans>
        </p>
        <p className="mt-[1px] text-[5.5px] leading-[1.4] text-neutral-500">
          <Trans>
            Lila wandered between the tall pines, her flashlight catching
            glimmers of gold among the leaves. The path narrowed, and the
            wind began to whisper her name.
          </Trans>
        </p>
      </div>
    </div>
  )
}
