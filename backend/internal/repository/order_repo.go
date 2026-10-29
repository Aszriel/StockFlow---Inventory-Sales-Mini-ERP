package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"time"

	"stockflow-backend/internal/model"
)

var (
	ErrOrderNotFound         = errors.New("order not found")
	ErrOrderAlreadyCancelled = errors.New("order is already cancelled")
	ErrProductInactive       = errors.New("product is inactive and cannot be ordered")
)

type OrderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

type lockedItemInfo struct {
	productID int
	sku       string
	qty       int
	unitPrice int
}

func (r *OrderRepository) Create(ctx context.Context, req model.CreateOrderRequest) (*model.SalesOrder, error) {
	// Aggregate quantities if duplicates happen, or reject if invalid
	// Let's sort items by SKU to prevent deadlocks across concurrent orders
	itemsMap := make(map[string]int)
	for _, item := range req.Items {
		itemsMap[item.SKU] += item.Qty
	}

	skus := make([]string, 0, len(itemsMap))
	for sku := range itemsMap {
		skus = append(skus, sku)
	}
	sort.Strings(skus)

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin order transaction: %w", err)
	}
	defer tx.Rollback()

	total := 0
	lockedItems := make([]lockedItemInfo, 0, len(skus))

	for _, sku := range skus {
		requestedQty := itemsMap[sku]

		// Row lock with FOR UPDATE
		var productID int
		var price int
		var stock int
		var isActive bool

		lockQuery := `
			SELECT id, price, stock, is_active
			FROM products
			WHERE sku = $1
			FOR UPDATE
		`
		err := tx.QueryRowContext(ctx, lockQuery, sku).Scan(&productID, &price, &stock, &isActive)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, fmt.Errorf("product not found for SKU: %s", sku)
			}
			return nil, fmt.Errorf("failed to lock product %s: %w", sku, err)
		}

		if !isActive {
			return nil, fmt.Errorf("%w: %s", ErrProductInactive, sku)
		}

		// Strict concurrency stock check
		if stock < requestedQty {
			return nil, &InsufficientStockError{
				SKU:       sku,
				Available: stock,
			}
		}

		total += price * requestedQty
		lockedItems = append(lockedItems, lockedItemInfo{
			productID: productID,
			sku:       sku,
			qty:       requestedQty,
			unitPrice: price,
		})
	}

	// Insert into sales_orders
	orderInsertQuery := `
		INSERT INTO sales_orders (customer, status, total, created_at)
		VALUES ($1, 'CREATED', $2, NOW())
		RETURNING id, customer, status, total, created_at, cancelled_at
	`
	var order model.SalesOrder
	err = tx.QueryRowContext(ctx, orderInsertQuery, req.Customer, total).Scan(
		&order.ID,
		&order.Customer,
		&order.Status,
		&order.Total,
		&order.CreatedAt,
		&order.CancelledAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert sales order: %w", err)
	}

	orderItems := make([]model.SalesOrderItem, 0, len(lockedItems))

	for _, item := range lockedItems {
		// 1. Deduct product stock
		updateStockQuery := "UPDATE products SET stock = stock - $1 WHERE id = $2"
		if _, err := tx.ExecContext(ctx, updateStockQuery, item.qty, item.productID); err != nil {
			return nil, fmt.Errorf("failed to deduct stock for SKU %s: %w", item.sku, err)
		}

		// 2. Insert into sales_order_items
		itemInsertQuery := `
			INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
			VALUES ($1, $2, $3, $4)
			RETURNING id, order_id, sku, qty, unit_price
		`
		var oi model.SalesOrderItem
		err := tx.QueryRowContext(ctx, itemInsertQuery, order.ID, item.sku, item.qty, item.unitPrice).Scan(
			&oi.ID,
			&oi.OrderID,
			&oi.SKU,
			&oi.Qty,
			&oi.UnitPrice,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert sales order item %s: %w", item.sku, err)
		}
		orderItems = append(orderItems, oi)

		// 3. Record stock movement
		movementQuery := `
			INSERT INTO stock_movements (product_id, type, qty, note, created_at)
			VALUES ($1, 'out', $2, $3, NOW())
		`
		note := fmt.Sprintf("Sales Order #%d deduction", order.ID)
		if _, err := tx.ExecContext(ctx, movementQuery, item.productID, item.qty, note); err != nil {
			return nil, fmt.Errorf("failed to record stock movement for SKU %s: %w", item.sku, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order transaction: %w", err)
	}

	order.Items = orderItems
	return &order, nil
}

func (r *OrderRepository) Cancel(ctx context.Context, orderID int) (*model.SalesOrder, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin cancel order transaction: %w", err)
	}
	defer tx.Rollback()

	// Lock order row
	var currentStatus string
	lockOrderQuery := "SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE"
	err = tx.QueryRowContext(ctx, lockOrderQuery, orderID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to lock sales order: %w", err)
	}

	if currentStatus == string(model.OrderStatusCancelled) {
		return nil, ErrOrderAlreadyCancelled
	}

	// Fetch order items
	itemQuery := `
		SELECT sku, qty 
		FROM sales_order_items 
		WHERE order_id = $1 
		ORDER BY sku ASC
	`
	rows, err := tx.QueryContext(ctx, itemQuery, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch order items: %w", err)
	}
	defer rows.Close()

	type cancelItem struct {
		sku string
		qty int
	}
	var itemsToReturn []cancelItem
	for rows.Next() {
		var ci cancelItem
		if err := rows.Scan(&ci.sku, &ci.qty); err != nil {
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		itemsToReturn = append(itemsToReturn, ci)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Return stock and record stock movements
	for _, it := range itemsToReturn {
		var productID int
		// Update product stock and obtain product id
		updateProductQuery := `
			UPDATE products 
			SET stock = stock + $1 
			WHERE sku = $2 
			RETURNING id
		`
		err := tx.QueryRowContext(ctx, updateProductQuery, it.qty, it.sku).Scan(&productID)
		if err != nil {
			return nil, fmt.Errorf("failed to return stock for SKU %s: %w", it.sku, err)
		}

		movementQuery := `
			INSERT INTO stock_movements (product_id, type, qty, note, created_at)
			VALUES ($1, 'in', $2, $3, NOW())
		`
		note := fmt.Sprintf("Sales Order #%d cancellation return", orderID)
		if _, err := tx.ExecContext(ctx, movementQuery, productID, it.qty, note); err != nil {
			return nil, fmt.Errorf("failed to insert return movement for SKU %s: %w", it.sku, err)
		}
	}

	// Update order status and cancelled_at timestamp
	now := time.Now()
	updateOrderQuery := `
		UPDATE sales_orders 
		SET status = 'CANCELLED', cancelled_at = $1 
		WHERE id = $2
	`
	if _, err := tx.ExecContext(ctx, updateOrderQuery, now, orderID); err != nil {
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order cancellation: %w", err)
	}

	return r.GetByID(ctx, orderID)
}

func (r *OrderRepository) GetByID(ctx context.Context, id int) (*model.SalesOrder, error) {
	orderQuery := `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		WHERE id = $1
	`
	var order model.SalesOrder
	err := r.db.QueryRowContext(ctx, orderQuery, id).Scan(
		&order.ID,
		&order.Customer,
		&order.Status,
		&order.Total,
		&order.CreatedAt,
		&order.CancelledAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to get sales order: %w", err)
	}

	itemsQuery := `
		SELECT id, order_id, sku, qty, unit_price
		FROM sales_order_items
		WHERE order_id = $1
		ORDER BY id ASC
	`
	rows, err := r.db.QueryContext(ctx, itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get sales order items: %w", err)
	}
	defer rows.Close()

	items := make([]model.SalesOrderItem, 0)
	for rows.Next() {
		var oi model.SalesOrderItem
		if err := rows.Scan(&oi.ID, &oi.OrderID, &oi.SKU, &oi.Qty, &oi.UnitPrice); err != nil {
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		items = append(items, oi)
	}
	order.Items = items

	return &order, nil
}

func (r *OrderRepository) List(ctx context.Context) ([]model.SalesOrder, error) {
	orderQuery := `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		ORDER BY created_at DESC, id DESC
	`
	rows, err := r.db.QueryContext(ctx, orderQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to list sales orders: %w", err)
	}
	defer rows.Close()

	orders := make([]model.SalesOrder, 0)
	for rows.Next() {
		var o model.SalesOrder
		if err := rows.Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt); err != nil {
			return nil, fmt.Errorf("failed to scan sales order: %w", err)
		}
		orders = append(orders, o)
	}

	if len(orders) == 0 {
		return orders, nil
	}

	// Fetch all items for these orders
	itemsQuery := `
		SELECT id, order_id, sku, qty, unit_price
		FROM sales_order_items
		ORDER BY id ASC
	`
	itemRows, err := r.db.QueryContext(ctx, itemsQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch items: %w", err)
	}
	defer itemRows.Close()

	itemsByOrderID := make(map[int][]model.SalesOrderItem)
	for itemRows.Next() {
		var oi model.SalesOrderItem
		if err := itemRows.Scan(&oi.ID, &oi.OrderID, &oi.SKU, &oi.Qty, &oi.UnitPrice); err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		itemsByOrderID[oi.OrderID] = append(itemsByOrderID[oi.OrderID], oi)
	}

	for i := range orders {
		orders[i].Items = itemsByOrderID[orders[i].ID]
	}

	return orders, nil
}
