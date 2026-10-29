export interface Product {
  id: number
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
  created_at: string
  last_movement_at: string | null
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface ProductListResponse {
  data: Product[]
  meta: PaginationMeta
}

export interface ProductSummary {
  total_products: number
  active_products: number
  total_inventory_value: number
  low_stock_count: number
}

export interface StockMovement {
  id: number
  product_id: number
  type: 'in' | 'out'
  qty: number
  note: string
  created_at: string
}

export interface SalesOrderItem {
  id: number
  order_id: number
  sku: string
  qty: number
  unit_price: number
}

export type OrderStatus = 'CREATED' | 'CANCELLED'

export interface SalesOrder {
  id: number
  customer: string
  status: OrderStatus
  total: number
  created_at: string
  cancelled_at: string | null
  items?: SalesOrderItem[]
}

export interface ApiErrorDetail {
  code: string
  message: string
  field?: string
  sku?: string
  available?: number
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail
}

export interface CreateProductPayload {
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
}

export interface UpdateProductPayload {
  sku: string
  name: string
  price: number
  is_active: boolean
}

export interface AdjustStockPayload {
  type: 'in' | 'out'
  qty: number
  note: string
}

export interface OrderItemPayload {
  sku: string
  qty: number
}

export interface CreateOrderPayload {
  customer: string
  items: OrderItemPayload[]
}
