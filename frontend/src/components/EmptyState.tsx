import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
  variant?: 'empty' | 'error'
}

export default function EmptyState({
  icon,
  title,
  message,
  action,
  variant = 'empty',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icon && (
        <div
          className={`mb-3 ${
            variant === 'error' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {message && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
