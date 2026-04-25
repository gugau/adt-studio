import { Hand, Play, Video } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { LandingPageShell } from "../../components/LandingPageShell"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock sign-language preview (book page with video overlay) ─────────────

function MockSignLanguagePreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-white">
      <div className="flex flex-1 gap-4 px-6 py-6">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-2">
          <p className="text-center text-[13px] font-bold tracking-tight text-foreground">
            Chapter Three
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Accessibility in digital books is not an afterthought — it's a core feature that determines who can reach your content and how effectively they can engage with it.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            For Deaf and hard-of-hearing readers, sign language videos turn written text into a fluent, visual narration in their first language.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Research shows that reading comprehension improves significantly when readers who are native signers can follow along with video in their preferred language.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Each page of a book can carry its own sign-language track, giving the reader a parallel path through the material that complements the written word.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            When videos are placed alongside text, readers can look away, catch a phrase, and return seamlessly — just as they would with audio narration.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Sign language is a rich, structured language with its own grammar, not a transliteration of written words. Good translations require fluent signers.
          </p>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-2 pb-[120px]">
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Professional interpreters are typically filmed against a clean background with even lighting so that hand shapes and facial expressions stay legible.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Facial expression carries grammatical meaning — it marks questions, conditionals, and intensity — so videos must show the signer's face clearly.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Each page's video is kept short so readers can replay it easily — one paragraph at a time — rather than fighting through a single long recording.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Videos travel with the book bundle, so the reader sees the same signer consistently no matter where they open the content.
          </p>
          <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
            Native signers bring nuance that automated avatars cannot match — pacing, emphasis, and regional variants of a sign all carry meaning that's hard to synthesize.
          </p>
        </div>
      </div>

      {/* Sign-language video player — anchored bottom-right */}
      <div className="absolute right-4 bottom-4 w-[36%] max-w-[170px] aspect-[4/3] rounded-md border-2 border-cyan-300 bg-gradient-to-br from-cyan-100 via-sky-100 to-cyan-50 shadow-[0_0_0_3px_rgba(6,182,212,0.12),0_8px_20px_-4px_rgba(6,182,212,0.25)] overflow-hidden transition-all">
        {/* Mock signer silhouette */}
        <div className="absolute inset-0 flex items-end justify-center">
          <div className="w-16 h-16 rounded-t-full bg-cyan-600/30 mb-6" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center gap-1">
          <div className="w-7 h-7 rounded-full bg-cyan-700/40" />
          <div className="flex gap-1">
            <div className="w-2.5 h-3 rounded-sm bg-cyan-600/40" />
            <div className="w-2.5 h-3 rounded-sm bg-cyan-600/40" />
          </div>
        </div>
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-cyan-900/10">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 shadow-lg">
            <Play className="w-3.5 h-3.5 text-cyan-700 fill-cyan-700 ml-0.5" />
          </div>
        </div>
        {/* Label */}
        <div className="absolute top-1 left-1 flex items-center gap-1 bg-cyan-700/90 rounded px-1.5 py-0.5">
          <Hand className="w-2 h-2 text-white" />
          <span className="text-[6.5px] font-semibold text-white">Sign Language</span>
        </div>
        {/* Duration */}
        <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
          <span className="text-[6px] font-mono tabular-nums text-white">0:42</span>
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function SignLanguageLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)

  const handleOpen = () => {
    void navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "sign-language" },
    })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="sign-language"
      colorClass="bg-cyan-600 hover:bg-cyan-700"
      isRunning={false}
      isCompleted={false}
      hasError={false}
      canRun={canRun}
      runLabel={<Trans>Manage Videos</Trans>}
      rerunLabel={<Trans>Manage Videos</Trans>}
      previewLabel={t`Sign Language Preview`}
      onRun={handleOpen}
      preview={<MockSignLanguagePreview />}
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Sign Language</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Upload sign-language videos and assign them to the pages of your
            book. Videos play inline alongside the text, giving Deaf and
            hard-of-hearing readers a native-language path through the content.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="sign language videos"
        isLoading={prereqLoading}
      />

      {/* Info banner */}
      <div className="rounded-xl bg-cyan-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-cyan-100 p-1.5">
            <Video className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <span className="text-[13px] font-semibold text-cyan-900">
            <Trans>Manual stage — not generated</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-cyan-800/80 leading-relaxed pl-[34px]">
          <Trans>
            Upload videos yourself and assign each one to the page it
            narrates.
          </Trans>
        </p>
      </div>
    </LandingPageShell>
  )
}
