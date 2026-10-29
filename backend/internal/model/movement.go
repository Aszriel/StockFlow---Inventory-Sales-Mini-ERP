package model

import "time"

type StockMovement struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	Type      string    `json:"type"` // "in" or "out"
	Qty       int       `json:"qty"`  // > 0
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}
