import { useAtomValue } from "jotai"
import { appConfigAtom } from "@/state/config.atoms"

/**
 * Cover + title + author block on the left side of the dock. Rendered only
 * when at least one of title/author is present; cover image self-hides on
 * load error so a missing `cover.png` doesn't leave a broken thumbnail.
 */
export function BookMetadata() {
  const config = useAtomValue(appConfigAtom)
  const displayTitle = config.shortTitle ?? config.title ?? ""
  const author = config.author ?? ""
  const cover = config.cover ?? "./cover.png"

  if (!displayTitle && !author) return null

  return (
    <div className="flex items-center gap-2.5 pl-1 pr-2 py-1 min-w-0">
      {cover ? (
        <img
          src={cover}
          alt=""
          className="h-10 w-10 rounded-lg object-cover shrink-0 ring-1 ring-border"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = "none"
          }}
        />
      ) : null}
      <div className="min-w-0 hidden sm:flex flex-col leading-tight">
        <span className="text-sm font-semibold truncate max-w-[12rem]">
          {displayTitle}
        </span>
        {author ? (
          <span className="text-xs text-muted-foreground truncate max-w-[12rem]">
            {author}
          </span>
        ) : null}
      </div>
    </div>
  )
}
