import React, { useState, useEffect } from 'react'
import type { Product, StockMovement } from '../types/api'
import { api, ApiClientError } from '../services/api'
import { formatDateTime } from '../utils/format'
import { X, History, ArrowDownLeft, ArrowUpRight, AlertCircle, RefreshCw } from 'lucide-react'

interface MovementHistoryModalProps {
  product: Product
  onClose: () => void
}

export const MovementHistoryModal: React.FC<MovementHistoryModalProps> = ({
  product,
  onClose,
}) => {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchMovements = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await api.getProductMovements(product.id)
      setMovements(data)
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Gagal mengambil data mutasi stok.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements()
  }, [product.id])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <History size={20} />
            </div>
            <div>
              <h3>Riwayat Pergerakan Stok</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {product.name} (<span className="font-mono">{product.sku}</span>)
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-icon" onClick={fetchMovements} disabled={loading} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div className="alert-banner alert-danger">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="state-container">
              <div className="spinner" />
              <p>Memuat mutasi stok...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="state-container">
              <History size={48} />
              <p>Belum ada riwayat pergerakan stok untuk produk ini.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipe</th>
                    <th>Jumlah</th>
                    <th>Catatan</th>
                    <th>Waktu Mutasi</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className={`badge ${m.type === 'in' ? 'badge-in' : 'badge-out'}`}>
                          {m.type === 'in' ? (
                            <>
                              <ArrowDownLeft size={14} /> Masuk (IN)
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={14} /> Keluar (OUT)
                            </>
                          )}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: m.type === 'in' ? '#34d399' : '#f87171' }}>
                        {m.type === 'in' ? `+${m.qty}` : `-${m.qty}`} unit
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.note || '-'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                        {formatDateTime(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
