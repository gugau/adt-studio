import { useAtomValue, useAtom } from "jotai";
import { appConfigAtom } from "@/shared/state/config.atoms";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useDockContext } from "@/features/dock/context/dock-context";
import { cn } from "@/shared/lib/utils";
import {
  dockMenuValueAtom,
  type DockMenuValue,
} from "@/shared/state/ui.atoms"

interface BookMetadata {
  ariaLabel: string;
  tooltip?: string;
  pressed?: boolean;
  className?: string;
}
export function BookMetadata({
  ariaLabel,
  tooltip,
  pressed,
  className,
}: BookMetadata) {
  const [value, setValue] = useAtom(dockMenuValueAtom)
  const toggle = (next: DockMenuValue) =>
    setValue((prev) => (prev === next ? "" : next))

  const config = useAtomValue(appConfigAtom);
  const displayTitle = config.shortTitle ?? config.title ?? "";
  const author = config.author ?? "";
  const cover = config.cover ?? "./cover.png";
  const { popoverSide } = useDockContext();

  if (!displayTitle && !author) return null;

  const label = tooltip ?? ariaLabel;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            title={label}
            aria-pressed={pressed}
            data-dock-trigger=""
            className={cn(
              "rounded-lg flex items-center justify-center shrink-0",
              "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-30 disabled:hover:bg-transparent",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              "aria-pressed:bg-accent aria-pressed:text-accent-foreground",
              "h-11 gap-2 p-2",
              className,
            )}
            onClick={() => toggle("toc")}
          >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover shrink-0 ring-1 ring-border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : null}
              <div className="min-w-0 hidden sm:flex flex-col leading-tight">
                <span className="text-sm font-semibold truncate w-[12rem]">
                  {displayTitle}
                </span>
                {author ? (
                  <span className="text-xs text-muted-foreground truncate max-w-[12rem]">
                    {author}
                  </span>
                ) : null}
              </div>
          </button>
        }
      />
      <TooltipContent side={popoverSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
