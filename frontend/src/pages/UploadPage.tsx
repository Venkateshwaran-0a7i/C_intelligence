import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Camera,
  CheckCircle,
  FlaskConical,
  ImagePlus,
  Loader2,
  PlusCircle,
  Upload,
  X,
} from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { ExtractResponse } from '../types'
import LimsSearchModal from '../components/LimsSearchModal'

type Stage = 'idle' | 'extracting' | 'lims'

/** Strip placeholder / empty values before building the LIMS default query. */
function cleanValue(value?: string): string | undefined {
  const v = (value || '').trim()
  if (!v || v.toLowerCase() === 'not available') return undefined
  return v
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const navigate = useNavigate()

  const [files, setFiles] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // Attach the live stream to the video element once the overlay is mounted.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOpen])

  // Stop the camera stream on unmount (e.g. navigating away mid-capture).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Camera handlers ──────────────────────────────────────────────────────────

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
      // Actual srcObject assignment happens in the useEffect above,
      // after the video element is rendered.
    } catch {
      setError('Could not access the camera. Check browser permissions.')
    }
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setFiles((prev) => [...prev, file])
    }, 'image/jpeg', 0.92)
  }

  // ── Extract handler ──────────────────────────────────────────────────────────

  const handleExtract = async () => {
    if (files.length === 0) return
    setError(null)
    setStage('extracting')
    try {
      const formData = new FormData()
      for (const f of files) formData.append('images', f)
      const result = await api.extract(formData)
      setExtractResult(result)

      if (!result.product_id) {
        setError(
          result.product_link_error ||
            'Extraction succeeded but the product could not be linked or created.',
        )
        setStage('idle')
        return
      }

      setStage('lims')
    } catch (e) {
      setStage('idle')
      setError(e instanceof ApiError ? e.message : 'Extraction failed')
    }
  }

  const reset = () => {
    setFiles([])
    setError(null)
    setExtractResult(null)
    setStage('idle')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Upload product images</h1>

      {/* ── Idle: file picker ───────────────────────────────────────────────── */}
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
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Browse files
              </button>
              <button
                type="button"
                onClick={() => void openCamera()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-4 w-4" />
                Take photo
              </button>
            </div>
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
                    <span className="truncate text-sm text-slate-700">{f.name}</span>
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

      {/* ── Camera overlay ──────────────────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="max-h-[70vh] rounded-lg"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={closeCamera}
              className="rounded-full border border-white px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Extracting: spinner ─────────────────────────────────────────────── */}
      {stage === 'extracting' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-slate-600">
            Analyzing {files.length} image{files.length === 1 ? '' : 's'} and extracting
            product data…
          </p>
        </div>
      )}

      {/* ── LIMS step ───────────────────────────────────────────────────────── */}
      {stage === 'lims' && extractResult?.product_id && (
        <div className="space-y-4">
          {/* Auto-match result banner */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
              extractResult.product_action === 'link'
                ? 'border-teal-200 bg-teal-50 text-teal-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {extractResult.product_action === 'link' ? (
              <>
                <CheckCircle className="h-4 w-4 shrink-0" />
                Matched to an existing product (score {extractResult.match_score}).
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 shrink-0" />
                No close match found — added as a new product.
              </>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
            <FlaskConical className="h-4 w-4 shrink-0 text-teal-600" />
            <p className="text-sm font-medium text-slate-700">
              Link a lab sample <span className="font-normal text-slate-400">(optional)</span>
            </p>
          </div>

          {/* Reuse existing LimsSearchModal */}
          <LimsSearchModal
            productId={extractResult.product_id}
            productDataId={extractResult.product_data_id ?? ''}
            defaultQuery={[
              extractResult.extracted_json?.product_identification?.product_brand?.value,
              extractResult.extracted_json?.product_identification?.product_name?.value,
              extractResult.extracted_json?.product_identification?.product_variant?.value,
            ]
              .map((v) => cleanValue(v))
              .filter(Boolean)
              .join(' ')}
            onClose={() => navigate(`/products/${extractResult.product_id}`)}
            onAttached={() => navigate(`/products/${extractResult.product_id}`)}
          />

          <button
            type="button"
            onClick={() => navigate(`/products/${extractResult.product_id}`)}
            className="block text-sm text-slate-500 hover:text-slate-800"
          >
            Skip for now — link a LIMS sample later
          </button>
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────────── */}
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

      {/* ── Cancel during extraction ─────────────────────────────────────────── */}
      {stage === 'extracting' && !error && (
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
