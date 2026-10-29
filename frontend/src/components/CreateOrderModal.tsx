import React, { useState } from 'react'
import type { Product } from '../types/api'
import { api, ApiClientError } from '../services/api'
import { formatIDR } from '../utils/format'
import { X, Plus, Trash2, AlertCircle, ShoppingCart } from 'lucide-react'

interface CreateOrderModalProps {
  products: Product[]
  onClose: () => void
  onSuccess: () => void
}

interface OrderItemRow {
  sku: string
  qty: number
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  products,
  onClose,
  onSuccess,
}) => {
  const [customer, setCustomer] = useState('')
  const [items, setItems] = useState<OrderItemRow[]>([
    { sku: products[0]?.sku || '', qty: 1 },
  ])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [failingSKU, setFailingSKU] = useState<string | null>(null)

  const activeProducts = products.filter((p) => p.is_active)

  const handleAddItem = () => {
    // Find first product not yet in items
    const selectedSKUs = new Set(items.map((i) => i.sku))
    const available = activeProducts.find((p) => !selectedSKUs.has(p.sku))
    if (available) {
      setItems([...items, { sku: available.sku, qty: 1 }])
    } else {
      setItems([...items, { sku: activeProducts[0]?.sku || '', qty: 1 }])
    }
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index: number, field: 'sku' | 'qty', value: string | number) => {
    const updated = [...items]
    if (field === 'sku') {
      updated[index].sku = String(value)
      if (failingSKU === value) {
        setFailingSKU(null)
      }
    } else {
      updated[index].qty = Math.max(1, Number(value) || 1)
    }
    setItems(updated)
  }

  // Calculate estimated total
  const estimatedTotal = items.reduce((sum, item) => {
    const prod = products.find((p) => p.sku === item.sku)
    return sum + (prod ? prod.price * item.qty : 0)
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer.trim()) {
      setErrorMsg('Nama pelanggan wajib diisi.')
      return
    }

    if (items.length === 0) {
      setErrorMsg('Pesanan harus memiliki minimal 1 item.')
      return
    }

    // Check client duplicate SKUs
    const seen = new Set<string>()
    for (const it of items) {
      if (seen.has(it.sku)) {
        setErrorMsg(`Terdapat SKU duplikat (${it.sku}). Silakan gabungkan jumlahnya.`)
        setFailingSKU(it.sku)
        return
      }
      seen.add(it.sku)
    }

    setLoading(true)
    setErrorMsg(null)
    setFailingSKU(null)

    try {
      await api.createOrder({
        customer: customer.trim(),
        items: items.map((i) => ({ sku: i.sku, qty: i.qty })),
      })
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          setFailingSKU(err.sku || null)
          setErrorMsg(
            `Stok tidak mencukupi untuk SKU "${err.sku}". Tersedia: ${err.available ?? 0} unit.`
          )
        } else if (err.code === 'PRODUCT_INACTIVE') {
          setErrorMsg(`Produk non-aktif tidak dapat dipesan: ${err.message}`)
        } else {
          setErrorMsg(err.message || 'Gagal membuat pesanan penjualan.')
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
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3>Buat Pesanan Penjualan (Sales Order)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Pengurangan stok terjadi secara atomik (Rollback jika stok kurang)
              </p>
            </div>
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

            <div className="form-group">
              <label htmlFor="customer">Nama Pelanggan / Perusahaan *</label>
              <input
                id="customer"
                type="text"
                className="form-control"
                placeholder="Contoh: PT Teknologi Maju Bersama"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Daftar Produk Pesanan</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={handleAddItem}
                  disabled={loading}
                >
                  <Plus size={14} /> Tambah Item
                </button>
              </div>

              <div className="order-items-builder">
                {items.map((item, index) => {
                  const selectedProd = products.find((p) => p.sku === item.sku)
                  const isFailing = failingSKU === item.sku

                  return (
                    <div
                      key={index}
                      className="order-item-row"
                      style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        background: isFailing ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        border: isFailing ? '1px solid var(--accent-rose)' : '1px solid transparent',
                      }}
                    >
                      <div>
                        <select
                          className="form-control"
                          value={item.sku}
                          onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                          disabled={loading}
                        >
                          {activeProducts.map((p) => (
                            <option key={p.id} value={p.sku}>
                              {p.name} ({p.sku}) — Stok: {p.stock} | {formatIDR(p.price)}
                            </option>
                          ))}
                        </select>
                        {selectedProd && (
                          <div style={{ fontSize: '11px', color: selectedProd.stock < item.qty ? '#f87171' : 'var(--text-dim)', marginTop: '4px' }}>
                            Tersedia: {selectedProd.stock} unit | Subtotal: {formatIDR(selectedProd.price * item.qty)}
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="number"
                          min="1"
                          className={`form-control ${isFailing ? 'is-invalid' : ''}`}
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          disabled={loading}
                          placeholder="Qty"
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length <= 1 || loading}
                        title="Hapus baris"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Estimasi Total Pesanan</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  (Harga satuan resmi dikunci langsung oleh server dari database)
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#60a5fa' }}>
                {formatIDR(estimatedTotal)}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Memproses Transaksi...' : 'Konfirmasi & Buat Pesanan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
