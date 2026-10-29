import { useState, useEffect, useCallback, useRef } from 'react'
import type { Product, ProductSummary, PaginationMeta } from './types/api'
import { api, ApiClientError } from './services/api'
import { SummaryCards } from './components/SummaryCards'
import { ProductTable } from './components/ProductTable'
import { AdjustStockModal } from './components/AdjustStockModal'
import { CreateOrderModal } from './components/CreateOrderModal'
import { OrderListModal } from './components/OrderListModal'
import { MovementHistoryModal } from './components/MovementHistoryModal'
import { ProductModal } from './components/ProductModal'
import {
  Boxes,
  Plus,
  ShoppingCart,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  })
  const [summary, setSummary] = useState<ProductSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ type, message })
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  // Modals state
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null)
  const [movementModalProduct, setMovementModalProduct] = useState<Product | null>(null)
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false)
  const [orderListModalOpen, setOrderListModalOpen] = useState<boolean>(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch summary metrics
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const data = await api.getProductSummary()
      setSummary(data)
    } catch {
      // ignore summary fail gracefully
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getProducts({
        page,
        limit: 10,
        search: debouncedSearch,
        filter,
      })
      setProducts(res.data)
      setMeta(res.meta)
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Gagal menghubungkan ke server API Go. Pastikan backend aktif.')
      }
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, filter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const refreshAll = () => {
    fetchProducts()
    fetchSummary()
  }

  // Handle delete with 409 history check
  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Yakin ingin menghapus produk "${product.name}" (${product.sku})?`)) {
      return
    }

    try {
      await api.deleteProduct(product.id)
      showToast('success', `Produk "${product.name}" berhasil dihapus.`)
      refreshAll()
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'PRODUCT_HAS_HISTORY') {
          showToast(
            'error',
            `Gagal menghapus! Produk "${product.sku}" memiliki riwayat mutasi stok atau pesanan (HTTP 409).`
          )
        } else {
          showToast('error', err.message || 'Gagal menghapus produk.')
        }
      } else {
        showToast('error', 'Terjadi kesalahan saat menghapus produk.')
      }
    }
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            minWidth: '320px',
            maxWidth: '460px',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease-out',
          }}
          className={`alert-banner ${toast.type === 'success' ? 'alert-success' : 'alert-danger'}`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <div style={{ flex: 1 }}>{toast.message}</div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">
            <Boxes size={24} color="#ffffff" />
          </div>
          <div>
            <h1 className="brand-title">StockFlow</h1>
            <div className="brand-subtitle">
              Mini ERP Module &bull; Manajemen Produk, Stok &amp; Transaksi Konkuren
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-secondary btn-icon"
            onClick={refreshAll}
            title="Muat ulang data"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setOrderListModalOpen(true)}
          >
            <ShoppingBag size={16} /> Riwayat Orders
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setOrderModalOpen(true)}
          >
            <ShoppingCart size={16} /> Buat Order
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setEditingProduct(null)
              setProductModalOpen(true)
            }}
          >
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </header>

      {/* Summary Metrics */}
      <SummaryCards summary={summary} loading={summaryLoading} />

      {/* Main Products Panel */}
      <ProductTable
        products={products}
        meta={meta}
        loading={loading}
        error={error}
        searchTerm={searchTerm}
        filter={filter}
        onSearchChange={setSearchTerm}
        onFilterChange={(newFilter) => {
          setFilter(newFilter)
          setPage(1)
        }}
        onPageChange={setPage}
        onRetry={fetchProducts}
        onAdjustStock={(p) => setAdjustModalProduct(p)}
        onEditProduct={(p) => {
          setEditingProduct(p)
          setProductModalOpen(true)
        }}
        onViewMovements={(p) => setMovementModalProduct(p)}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* Modals */}
      {adjustModalProduct && (
        <AdjustStockModal
          product={adjustModalProduct}
          onClose={() => setAdjustModalProduct(null)}
          onSuccess={() => {
            setAdjustModalProduct(null)
            showToast('success', 'Penyesuaian stok berhasil disimpan!')
            refreshAll()
          }}
        />
      )}

      {movementModalProduct && (
        <MovementHistoryModal
          product={movementModalProduct}
          onClose={() => setMovementModalProduct(null)}
        />
      )}

      {productModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setProductModalOpen(false)
            setEditingProduct(null)
          }}
          onSuccess={() => {
            setProductModalOpen(false)
            setEditingProduct(null)
            showToast('success', editingProduct ? 'Produk berhasil diperbarui!' : 'Produk baru berhasil ditambahkan!')
            refreshAll()
          }}
        />
      )}

      {orderModalOpen && (
        <CreateOrderModal
          products={products}
          onClose={() => setOrderModalOpen(false)}
          onSuccess={() => {
            setOrderModalOpen(false)
            showToast('success', 'Transaksi Sales Order berhasil dibuat dan stok dipotong secara atomik!')
            refreshAll()
          }}
        />
      )}

      {orderListModalOpen && (
        <OrderListModal
          onClose={() => setOrderListModalOpen(false)}
          onOrderCancelled={() => {
            showToast('success', 'Pesanan dibatalkan dan seluruh stok item dikembalikan ke gudang!')
            refreshAll()
          }}
        />
      )}
    </div>
  )
}

export default App
