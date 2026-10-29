package model

import "time"

type Product struct {
	ID             int        `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int        `json:"price"` // in IDR, integer >= 0
	Stock          int        `json:"stock"` // integer >= 0
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"`
}

type CreateProductRequest struct {
	SKU      string `json:"sku"`
	Name     string `json:"name"`
	Price    *int   `json:"price"`
	Stock    *int   `json:"stock"`
	IsActive *bool  `json:"is_active"`
}

type UpdateProductRequest struct {
	SKU      string `json:"sku"`
	Name     string `json:"name"`
	Price    *int   `json:"price"`
	IsActive *bool  `json:"is_active"`
}

type AdjustStockRequest struct {
	Type string `json:"type"` // "in" or "out"
	Qty  int    `json:"qty"`  // > 0
	Note string `json:"note"`
}

type ProductFilter struct {
	Page   int
	Limit  int
	Search string
	Filter string // "all", "active", "inactive", "low_stock"
}

type PaginationMeta struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

type ProductListResponse struct {
	Data []Product      `json:"data"`
	Meta PaginationMeta `json:"meta"`
}

type ProductSummary struct {
	TotalProducts       int   `json:"total_products"`
	ActiveProducts      int   `json:"active_products"`
	TotalInventoryValue int64 `json:"total_inventory_value"`
	LowStockCount       int   `json:"low_stock_count"`
}
