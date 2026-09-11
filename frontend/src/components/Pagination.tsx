import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
      <span className="text-sm text-slate-500">
        {total} product{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
