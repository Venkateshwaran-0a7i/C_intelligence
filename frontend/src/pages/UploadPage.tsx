import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  ImagePlus,
  Loader2,
  PackageCheck,
  PackageSearch,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { ExtractResponse, MatchCandidate } from '../types'
import EmptyState from '../components/EmptyState'

type Stage = 'idle' | 'extracting' | 'matching' | 'confirming'

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const [files, setFiles] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null)
  const [candidates, setCandidates] = useState<MatchCandidate[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list)
    setFiles((prev) => [...prev, ...incoming])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleExtract = async () => {
    if (files.length === 0) return
    setError(null)
    setStage('extracting')
    try {
      const formData = new FormData()
      for (const f of files) formData.append('images', f)
      const result = await api.extract(formData)
      setExtractResult(result)

      const id = result.extracted_json?.product_identification
      const match = await api.matchProducts({
        product_name: id?.product_name?.value,
        brand: id?.product_brand?.value,
        variant: id?.product_variant?.value,
        net_quantity: id?.net_quantity?.value,
      })
      setCandidates(match.candidates)
      setStage('matching')
    } catch (e) {
      setStage('idle')
      setError(e instanceof ApiError ? e.message : 'Extraction failed')
    }
  }

  const handleConfirm = async (candidate?: MatchCandidate, createNew = false) => {
    if (!extractResult?.product_data_id) {
      setError('No product_data_id returned from extraction.')
      return
    }
    setConfirming(createNew ? 'new' : candidate?.product_id ?? '')
    setError(null)
    try {
      const confirmed = await api.confirmProduct({
        product_data_id: extractResult.product_data_id,
        action: createNew ? 'create_new' : 'link',
        ...(candidate && !createNew ? { product_id: candidate.product_id } : {}),
        confirmed_by: 'user',
      })
      navigate(`/products/${confirmed._id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to confirm product')
      setConfirming(null)
    }
  }

  const reset = () => {
    setFiles([])
    setError(null)
    setExtractResult(null)
    setCandidates([])
    setStage('idle')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Upload product images</h1>

      {stage === 'idle' && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center"
          >
            <ImagePlus className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-600">
              Drag and drop product packaging images here, or
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Box className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-700">
                      {f.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void handleExtract()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Upload className="h-4 w-4" />
                Extract product data ({files.length} image{files.length === 1 ? '' : 's'})
              </button>
            </div>
          )}
        </>
      )}

      {stage === 'extracting' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-slate-600">
            Analyzing {files.length} image{files.length === 1 ? '' : 's'} and extracting
            product data…
          </p>
        </div>
      )}

      {stage === 'matching' && extractResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <PackageCheck className="h-5 w-5 text-teal-600" />
              Extracted product
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <span className="text-slate-500">
                Name:{' '}
                <span className="text-slate-900">
                  {extractResult.extracted_json?.product_identification?.product_name?.value}
                </span>
              </span>
              <span className="text-slate-500">
                Brand:{' '}
                <span className="text-slate-900">
                  {extractResult.extracted_json?.product_identification?.product_brand?.value}
                </span>
              </span>
              <span className="text-slate-500">
                Variant:{' '}
                <span className="text-slate-900">
                  {extractResult.extracted_json?.product_identification?.product_variant?.value}
                </span>
              </span>
              <span className="text-slate-500">
                Net quantity:{' '}
                <span className="text-slate-900">
                  {extractResult.extracted_json?.product_identification?.net_quantity?.value}
                </span>
              </span>
            </div>
          </div>

          <h3 className="font-semibold text-slate-800">
            Does this match an existing product?
          </h3>

          {candidates.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-10 w-10" />}
              title="No existing matches found"
              message="No existing products matched this extraction. You can create a new product from it."
            />
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.product_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {c.product_name || 'Unnamed product'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {[c.brand, c.variant, c.net_quantity]
                        .filter((s) => s && s !== 'Not Available')
                        .join(' · ') || '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-teal-700">
                      Match score {c.score}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={confirming === c.product_id}
                    onClick={() => void handleConfirm(c)}
                    className="shrink-0 rounded-md border border-teal-600 bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {confirming === c.product_id ? 'Confirming…' : 'Same product'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={confirming === 'new'}
            onClick={() => void handleConfirm(undefined, true)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {confirming === 'new' ? 'Creating…' : 'None of these — new product'}
          </button>

          <button
            type="button"
            onClick={reset}
            className="block text-sm text-slate-500 hover:text-slate-800"
          >
            Start over
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {stage === 'idle' && (
            <button
              type="button"
              onClick={reset}
              className="ml-3 underline hover:text-red-900"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {(stage === 'extracting' || stage === 'matching') && !error && (
        <button
          type="button"
          onClick={reset}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
