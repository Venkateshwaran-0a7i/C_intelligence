import { Component, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { FlaskConical, Upload } from 'lucide-react'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import UploadPage from './pages/UploadPage'
import LimsAdminPage from './pages/LimsAdminPage'
import api from './lib/api'

// ── Error boundary ────────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-semibold text-red-800">
              Something went wrong rendering this page
            </h2>
            <p className="mt-2 text-sm text-red-700">
              {this.state.error.message}
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-red-100 p-2 text-xs text-red-900">
              {this.state.error.stack}
            </pre>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null })
                window.location.href = '/'
              }}
              className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
            >
              Back to products
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [apiUp, setApiUp] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .health()
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false))
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#FAF9F6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
        <Link to="/" className="text-base font-semibold text-slate-900">
          GptModel
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Products
          </NavLink>
          <NavLink to="/upload" className={linkClass}>
            <span className="inline-flex items-center gap-1">
              <Upload className="h-4 w-4" />
              Upload
            </span>
          </NavLink>
          <NavLink to="/lims" className={linkClass}>
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="h-4 w-4" />
              LIMS
            </span>
          </NavLink>
        </nav>
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${
            apiUp === true
              ? 'text-teal-600'
              : apiUp === false
                ? 'text-amber-600'
                : 'text-slate-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              apiUp === true
                ? 'bg-teal-500'
                : apiUp === false
                  ? 'bg-amber-500'
                  : 'bg-slate-300'
            }`}
          />
          {apiUp === true ? 'API online' : apiUp === false ? 'API offline' : 'Checking…'}
        </span>
      </div>
    </header>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="min-h-[calc(100vh-53px)]">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ProductListPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/lims" element={<LimsAdminPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </BrowserRouter>
  )
}
