export function DockSkeleton() {
  return (
    <div
      className="flex flex-1 items-center justify-between gap-2 px-2"
      aria-hidden="true"
      data-testid="dock-skeleton"
    >
      <div className="flex items-center gap-2.5 pl-1 pr-2 py-1 min-w-0">
        <div className="h-10 w-10 rounded-lg bg-muted/60 animate-pulse motion-reduce:animate-none" />
        <div className="hidden sm:flex flex-col gap-1.5">
          <div className="h-3 w-32 rounded bg-muted/60 animate-pulse motion-reduce:animate-none" />
          <div className="h-2 w-24 rounded bg-muted/40 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-10 rounded-lg bg-muted/60 animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  )
}
