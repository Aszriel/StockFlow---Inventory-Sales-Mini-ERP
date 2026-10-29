import type {
  ProductListResponse,
  ProductSummary,
  Product,
  StockMovement,
  SalesOrder,
  CreateProductPayload,
  UpdateProductPayload,
  AdjustStockPayload,
  CreateOrderPayload,
  ApiErrorEnvelope,
  ApiErrorDetail,
} from '../types/api'

export class ApiClientError extends Error {
  status: number
  code: string
  field?: string
  sku?: string
  available?: number

  constructor(status: number, detail: ApiErrorDetail) {
    super(detail.message || `API error with code: ${detail.code}`)
    this.name = 'ApiClientError'
    this.status = status
    this.code = detail.code
    this.field = detail.field
    this.sku = detail.sku
    this.available = detail.available
  }
}

const BASE_URL = '/api'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  // Handle errors
  if (!response.ok) {
    let errorDetail: ApiErrorDetail = {
      code: 'UNKNOWN_ERROR',
      message: response.statusText || 'An unexpected error occurred',
    }

    try {
      const errorJson: ApiErrorEnvelope = await response.json()
      if (errorJson && errorJson.error) {
        errorDetail = errorJson.error
      }
    } catch {
      // Non-JSON response
    }

    throw new ApiClientError(response.status, errorDetail)
  }

  return response.json() as Promise<T>
}

export const api = {
  // Product endpoints
  async getProducts(params?: {
    page?: number
    limit?: number
    search?: string
    filter?: string
  }): Promise<ProductListResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.filter && params.filter !== 'all') query.append('filter', params.filter)

    const queryString = query.toString() ? `?${query.toString()}` : ''
    return request<ProductListResponse>(`/products${queryString}`)
  },

  async getProductSummary(): Promise<ProductSummary> {
    return request<ProductSummary>('/products/summary')
  },

  async getProduct(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`)
  },

  async createProduct(payload: CreateProductPayload): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateProduct(id: number, payload: UpdateProductPayload): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async deleteProduct(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/products/${id}`, {
      method: 'DELETE',
    })
  },

  async adjustStock(id: number, payload: AdjustStockPayload): Promise<Product> {
    return request<Product>(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async getProductMovements(id: number): Promise<StockMovement[]> {
    return request<StockMovement[]>(`/products/${id}/movements`)
  },

  // Order endpoints
  async getOrders(): Promise<SalesOrder[]> {
    return request<SalesOrder[]>('/orders')
  },

  async getOrder(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}`)
  },

  async createOrder(payload: CreateOrderPayload): Promise<SalesOrder> {
    return request<SalesOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async cancelOrder(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}/cancel`, {
      method: 'POST',
    })
  },
}
