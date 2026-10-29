import React, { useState } from 'react'
import type { Product } from '../types/api'
import { api, ApiClientError } from '../services/api'
import { X, AlertCircle } from 'lucide-react'

interface AdjustStockModalProps {
  product: Product
  onClose: () => void
  onSuccess: () => void
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<'in' | 'out'>('in')
  const [qty, setQty] = useState<number>(1)
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (qty <= 0) {
      setErrorMsg('Jumlah stok harus lebih dari 0.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      await api.adjustStock(product.id, {
        type,
        qty,
        note: note.trim() || (type === 'in' ? 'Manual stock addition' : 'Manual stock reduction'),
      })
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          setErrorMsg(
            `Gagal memotong stok! Stok saat ini tersisa ${err.available ?? product.stock} unit, tidak mencukupi untuk pengurangan ${qty} unit.`
          )
        } else {
          setErrorMsg(err.message || 'Gagal mengubah stok produk.')
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
          <div>
            <h3>Penyesuaian Stok</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {product.name} (<span className="font-mono">{product.sku}</span>)
            </p>
          </div>
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

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '18px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Stok Saat Ini</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: product.stock <= 10 ? '#fbbf24' : 'var(--text-main)' }}>
                {product.stock} unit
              </div>
            </div>

            <div className="form-group">
              <label>Arah Penyesuaian</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className={`btn ${type === 'in' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setType('in')}
                  disabled={loading}
                >
                  + Tambah Stok (In)
                </button>
                <button
                  type="button"
                  className={`btn ${type === 'out' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setType('out')}
                  disabled={loading}
                >
                  - Kurang Stok (Out)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="qty">Jumlah (Qty)</label>
              <input
                id="qty"
                type="number"
                min="1"
                className="form-control"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="note">Catatan / Alasan</label>
              <input
                id="note"
                type="text"
                className="form-control"
                placeholder="Contoh: Restock batch #202, Retur barang cacat, dll."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
