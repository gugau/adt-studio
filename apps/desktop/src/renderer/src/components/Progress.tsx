function Progress({ downloadPercent }: { downloadPercent: number | null }) {
  return (
    <div
      className="relative h-0.5 w-40 overflow-hidden rounded-sm bg-slate-200"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={downloadPercent ?? undefined}
    >
      {downloadPercent === null ? (
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-sm bg-blue-500"
          style={{
            animation:
              "splash-indeterminate-bar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        />
      ) : (
        <div
          className="absolute inset-y-0 left-0 rounded-sm bg-blue-500 transition-[width] duration-150"
          style={{ width: `${downloadPercent}%` }}
        />
      )}
    </div>
  );
}

export { Progress }
