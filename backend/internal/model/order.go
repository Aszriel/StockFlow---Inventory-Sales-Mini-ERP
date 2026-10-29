package model

import "time"

type OrderStatus string

const (
	OrderStatusCreated   OrderStatus = "CREATED"
	OrderStatusCancelled OrderStatus = "CANCELLED"
)

type SalesOrderItem struct {
	ID        int    `json:"id"`
	OrderID   int    `json:"order_id"`
	SKU       string `json:"sku"`
	Qty       int    `json:"qty"`
	UnitPrice int    `json:"unit_price"`
}

type SalesOrder struct {
	ID          int              `json:"id"`
	Customer    string           `json:"customer"`
	Status      OrderStatus      `json:"status"`
	Total       int              `json:"total"`
	CreatedAt   time.Time        `json:"created_at"`
	CancelledAt *time.Time       `json:"cancelled_at,omitempty"`
	Items       []SalesOrderItem `json:"items,omitempty"`
}

type OrderItemRequest struct {
	SKU string `json:"sku"`
	Qty int    `json:"qty"`
}

type CreateOrderRequest struct {
	Customer string             `json:"customer"`
	Items    []OrderItemRequest `json:"items"`
}
