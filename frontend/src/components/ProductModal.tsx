import React, { useState } from 'react'
import type { Product } from '../types/api'
import { api, ApiClientError } from '../services/api'
import { X, AlertCircle } from 'lucide-react'

interface ProductModalProps {
  product?: Product | null // if provided, edit mode
  onClose: () => void
  onSuccess: () => void
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(product)

  const [sku, setSku] = useState(product?.sku || '')
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState<number>(product?.price || 0)
  const [stock, setStock] = useState<number>(product?.stock || 0)
  const [isActive, setIsActive] = useState<boolean>(product ? product.is_active : true)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sku.trim()) {
      setErrorMsg('SKU wajib diisi.')
      return
    }
    if (!name.trim()) {
      setErrorMsg('Nama produk wajib diisi.')
      return
    }
    if (price < 0) {
      setErrorMsg('Harga tidak boleh bernilai negatif.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      if (isEdit && product) {
        await api.updateProduct(product.id, {
          sku: sku.trim(),
          name: name.trim(),
          price,
          is_active: isActive,
        })
      } else {
        await api.createProduct({
          sku: sku.trim(),
          name: name.trim(),
          price,
          stock: Math.max(0, stock),
          is_active: isActive,
        })
      }
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'SKU_ALREADY_EXISTS') {
          setErrorMsg('SKU ini sudah terdaftar pada sistem. Gunakan SKU unik lain.')
        } else {
          setErrorMsg(err.message || 'Gagal menyimpan produk.')
        }
      } else {
        setErrorMsg('Terjadi kesalahan pada sistem.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Ubah Informasi Produk' : 'Tambah Produk Baru'}</h3>
          <button className="btn btn-secondary btn-icon" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="alert-banner alert-danger">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{errorMsg}</div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="prod-sku">SKU (Kode Unik) *</label>
              <input
                id="prod-sku"
                type="text"
                className="form-control font-mono"
                placeholder="Contoh: ELEC-KB-001"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="prod-name">Nama Produk *</label>
              <input
                id="prod-name"
                type="text"
                className="form-control"
                placeholder="Contoh: Keychron K2 Wireless Keyboard"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="prod-price">Harga Satuan (IDR) *</label>
              <input
                id="prod-price"
                type="number"
                min="0"
                step="1"
                className="form-control font-mono"
                placeholder="Contoh: 1250000"
                value={price}
                onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                required
                disabled={loading}
              />
            </div>

            {!isEdit && (
              <div className="form-group">
                <label htmlFor="prod-stock">Stok Awal</label>
                <input
                  id="prod-stock"
                  type="number"
                  min="0"
                  step="1"
                  className="form-control font-mono"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={loading}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Stok awal akan otomatis dicatat pada riwayat mutasi stok.
                </div>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
              <input
                id="prod-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={loading}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
              />
              <label htmlFor="prod-active" style={{ margin: 0, cursor: 'pointer', color: 'var(--text-main)' }}>
                Produk Aktif (Dapat dipesan & dijual)
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
