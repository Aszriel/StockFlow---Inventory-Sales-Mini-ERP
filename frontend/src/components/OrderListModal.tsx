import React, { useState, useEffect } from 'react'
import type { SalesOrder } from '../types/api'
import { api, ApiClientError } from '../services/api'
import { formatIDR, formatDateTime } from '../utils/format'
import { X, RefreshCw, AlertCircle, ShoppingBag, Ban, ChevronDown, ChevronUp } from 'lucide-react'

interface OrderListModalProps {
  onClose: () => void
  onOrderCancelled: () => void
}

export const OrderListModal: React.FC<OrderListModalProps> = ({
  onClose,
  onOrderCancelled,
}) => {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await api.getOrders()
      setOrders(data)
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Gagal memuat daftar pesanan.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm(`Yakin ingin membatalkan Sales Order #${orderId}? Seluruh stok item akan dikembalikan ke gudang.`)) {
      return
    }

    setCancellingId(orderId)
    setErrorMsg(null)
    try {
      await api.cancelOrder(orderId)
      await fetchOrders()
      onOrderCancelled()
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message || 'Gagal membatalkan pesanan.')
      } else {
        setErrorMsg('Terjadi kesalahan saat membatalkan pesanan.')
      }
    } finally {
      setCancellingId(null)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3>Riwayat Sales Orders</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Daftar transaksi pesanan dan fitur pembatalan (stok dikembalikan atomik)
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders} disabled={loading} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div className="alert-banner alert-danger">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="state-container">
              <div className="spinner" />
              <p>Memuat data pesanan...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="state-container">
              <ShoppingBag size={48} />
              <p>Belum ada riwayat pesanan penjualan.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orders.map((order) => {
                const isExpanded = expandedId === order.id
                const id = order.id
                const isCancelled = order.status === 'CANCELLED'

                return (
                  <div
                    key={id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      }}
                      onClick={() => toggleExpand(id)}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>Order #{id}</span>
                          <span className={`badge ${isCancelled ? 'badge-cancelled' : 'badge-created'}`}>
                            {order.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          Pelanggan: <strong style={{ color: 'var(--text-main)' }}>{order.customer}</strong> &bull; {formatDateTime(order.created_at)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa' }}>
                            {formatIDR(order.total)}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {order.items?.length || 0} item
                          </div>
                        </div>

                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
                        <h5 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                          Rincian Item Pesanan
                        </h5>
                        <table className="data-table" style={{ background: 'transparent', marginBottom: '14px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 12px' }}>SKU</th>
                              <th style={{ padding: '8px 12px' }}>Qty</th>
                              <th style={{ padding: '8px 12px' }}>Harga Satuan</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items?.map((item) => (
                              <tr key={item.id}>
                                <td style={{ padding: '8px 12px' }} className="font-mono">{item.sku}</td>
                                <td style={{ padding: '8px 12px' }}>{item.qty} unit</td>
                                <td style={{ padding: '8px 12px' }}>{formatIDR(item.unit_price)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                                  {formatIDR(item.qty * item.unit_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {isCancelled && order.cancelled_at && (
                          <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
                            Dibatalkan pada: {formatDateTime(order.cancelled_at)}
                          </div>
                        )}

                        {!isCancelled && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '13px', padding: '6px 14px' }}
                              onClick={() => handleCancelOrder(id)}
                              disabled={cancellingId === id}
                            >
                              <Ban size={15} />
                              {cancellingId === id ? 'Membatalkan...' : 'Batalkan Pesanan (Kembalikan Stok)'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
