import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { Upload } from 'lucide-react'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import UploadPage from './pages/UploadPage'
import api from './lib/api'

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

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="min-h-[calc(100vh-53px)]">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
