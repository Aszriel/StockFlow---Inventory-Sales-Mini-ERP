import React from 'react'
import type { Product, PaginationMeta } from '../types/api'
import { formatIDR, formatRelativeTime } from '../utils/format'
import {
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  History,
  AlertCircle,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'

interface ProductTableProps {
  products: Product[]
  meta: PaginationMeta
  loading: boolean
  error: string | null
  searchTerm: string
  filter: string
  onSearchChange: (search: string) => void
  onFilterChange: (filter: string) => void
  onPageChange: (page: number) => void
  onRetry: () => void
  onAdjustStock: (product: Product) => void
  onEditProduct: (product: Product) => void
  onViewMovements: (product: Product) => void
  onDeleteProduct: (product: Product) => void
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  meta,
  loading,
  error,
  searchTerm,
  filter,
  onSearchChange,
  onFilterChange,
  onPageChange,
  onRetry,
  onAdjustStock,
  onEditProduct,
  onViewMovements,
  onDeleteProduct,
}) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="tab-group">
          <button
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            Semua Produk
          </button>
          <button
            className={`tab-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => onFilterChange('active')}
          >
            Aktif
          </button>
          <button
            className={`tab-btn ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => onFilterChange('inactive')}
          >
            Non-Aktif
          </button>
          <button
            className={`tab-btn ${filter === 'low_stock' ? 'active' : ''}`}
            onClick={() => onFilterChange('low_stock')}
          >
            Low Stock (&le; 10)
          </button>
        </div>

        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari SKU atau nama produk..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="state-container">
          <AlertCircle size={44} style={{ color: '#f87171' }} />
          <p style={{ color: '#f87171', fontWeight: 600, marginBottom: '12px' }}>{error}</p>
          <button className="btn btn-secondary" onClick={onRetry}>
            Coba Lagi
          </button>
        </div>
      ) : loading ? (
        <div className="state-container">
          <div className="spinner" />
          <p>Memuat data produk...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="state-container">
          <PackageOpen size={48} />
          <p style={{ marginTop: '8px', fontSize: '15px' }}>Tidak ada produk yang cocok dengan kriteria pencarian/filter.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama Produk</th>
                  <th>Harga</th>
                  <th>Stok</th>
                  <th>Status</th>
                  <th>Mutasi Terakhir</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.stock <= 10
                  return (
                    <tr key={p.id}>
                      <td className="font-mono" style={{ fontWeight: 600, color: '#93c5fd' }}>
                        {p.sku}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="font-mono">{formatIDR(p.price)}</td>
                      <td>
                        <span
                          className={`badge ${isLow ? 'badge-lowstock' : ''}`}
                          style={{ fontWeight: 700 }}
                        >
                          {isLow && <AlertTriangle size={13} />}
                          {p.stock} unit
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {p.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {formatRelativeTime(p.last_movement_at)}
                      </td>
                      <td>
                        <div className="action-cell" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => onAdjustStock(p)}
                            title="Penyesuaian Stok (In/Out)"
                          >
                            <SlidersHorizontal size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => onViewMovements(p)}
                            title="Lihat Riwayat Mutasi"
                          >
                            <History size={15} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => onEditProduct(p)}
                            title="Edit Produk"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => onDeleteProduct(p)}
                            title="Hapus Produk"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div>
              Menampilkan {products.length} dari total {meta.total} produk
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-icon"
                disabled={meta.page <= 1}
                onClick={() => onPageChange(meta.page - 1)}
                title="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ padding: '0 8px', fontWeight: 600 }}>
                {meta.page} / {Math.max(1, meta.total_pages)}
              </span>
              <button
                className="btn btn-secondary btn-icon"
                disabled={meta.page >= meta.total_pages}
                onClick={() => onPageChange(meta.page + 1)}
                title="Halaman selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
