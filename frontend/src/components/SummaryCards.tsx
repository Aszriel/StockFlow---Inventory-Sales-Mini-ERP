import React from 'react'
import type { ProductSummary } from '../types/api'
import { formatIDR } from '../utils/format'
import { Package, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react'

interface SummaryCardsProps {
  summary: ProductSummary | null
  loading: boolean
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, loading }) => {
  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-info">
          <h4>Total Produk</h4>
          <div className="summary-value">
            {loading ? '-' : (summary?.total_products ?? 0)}
          </div>
        </div>
        <div className="summary-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
          <Package size={22} />
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-info">
          <h4>Produk Aktif</h4>
          <div className="summary-value">
            {loading ? '-' : (summary?.active_products ?? 0)}
          </div>
        </div>
        <div className="summary-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          <CheckCircle2 size={22} />
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-info">
          <h4>Total Nilai Stok</h4>
          <div className="summary-value" style={{ fontSize: '22px' }}>
            {loading ? '-' : formatIDR(summary?.total_inventory_value ?? 0)}
          </div>
        </div>
        <div className="summary-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
          <TrendingUp size={22} />
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-info">
          <h4>Low Stock (&le; 10)</h4>
          <div className="summary-value" style={{ color: (summary?.low_stock_count ?? 0) > 0 ? '#fbbf24' : 'inherit' }}>
            {loading ? '-' : (summary?.low_stock_count ?? 0)}
          </div>
        </div>
        <div className="summary-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
          <AlertTriangle size={22} />
        </div>
      </div>
    </div>
  )
}
