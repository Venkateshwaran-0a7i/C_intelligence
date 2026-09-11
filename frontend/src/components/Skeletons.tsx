export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-slate-100" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-5 w-16 rounded bg-slate-100" />
        <div className="h-5 w-16 rounded bg-slate-100" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/3 rounded bg-slate-100" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
            <div className="h-4 w-1/4 rounded bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="animate-pulse grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  )
}
