package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"stockflow-backend/internal/model"
)

var (
	ErrProductNotFound   = errors.New("product not found")
	ErrProductHasHistory = errors.New("product has movement history and cannot be deleted")
	ErrSKUAlreadyExists  = errors.New("sku already exists")
)

type InsufficientStockError struct {
	SKU       string
	Available int
}

func (e *InsufficientStockError) Error() string {
	return fmt.Sprintf("insufficient stock for SKU %s: available %d", e.SKU, e.Available)
}

type ProductRepository struct {
	db *sql.DB
}

func NewProductRepository(db *sql.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) List(ctx context.Context, f model.ProductFilter) (*model.ProductListResponse, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 10
	}
	offset := (f.Page - 1) * f.Limit

	var conditions []string
	var args []interface{}
	argIdx := 1

	if f.Search != "" {
		conditions = append(conditions, fmt.Sprintf("(p.sku ILIKE $%d OR p.name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}

	switch f.Filter {
	case "active":
		conditions = append(conditions, fmt.Sprintf("p.is_active = $%d", argIdx))
		args = append(args, true)
		argIdx++
	case "inactive":
		conditions = append(conditions, fmt.Sprintf("p.is_active = $%d", argIdx))
		args = append(args, false)
		argIdx++
	case "low_stock":
		conditions = append(conditions, fmt.Sprintf("p.stock <= $%d", argIdx))
		args = append(args, 10)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products p %s", whereClause)
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count products: %w", err)
	}

	// Data query with last_movement_at derived via subquery/join
	dataQuery := fmt.Sprintf(`
		SELECT 
			p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
			(SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = p.id) AS last_movement_at
		FROM products p
		%s
		ORDER BY p.id ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	products := make([]model.Product, 0)
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(
			&p.ID,
			&p.SKU,
			&p.Name,
			&p.Price,
			&p.Stock,
			&p.IsActive,
			&p.CreatedAt,
			&p.LastMovementAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + f.Limit - 1) / f.Limit
	}

	return &model.ProductListResponse{
		Data: products,
		Meta: model.PaginationMeta{
			Page:       f.Page,
			Limit:      f.Limit,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

func (r *ProductRepository) GetSummary(ctx context.Context) (*model.ProductSummary, error) {
	query := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE is_active = true),
			COALESCE(SUM(price::bigint * stock::bigint), 0),
			COUNT(*) FILTER (WHERE stock <= 10)
		FROM products
	`
	var summary model.ProductSummary
	if err := r.db.QueryRowContext(ctx, query).Scan(
		&summary.TotalProducts,
		&summary.ActiveProducts,
		&summary.TotalInventoryValue,
		&summary.LowStockCount,
	); err != nil {
		return nil, fmt.Errorf("failed to get product summary: %w", err)
	}
	return &summary, nil
}

func (r *ProductRepository) GetByID(ctx context.Context, id int) (*model.Product, error) {
	query := `
		SELECT 
			p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
			(SELECT MAX(sm.created_at) FROM stock_movements sm WHERE sm.product_id = p.id) AS last_movement_at
		FROM products p
		WHERE p.id = $1
	`
	var p model.Product
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID,
		&p.SKU,
		&p.Name,
		&p.Price,
		&p.Stock,
		&p.IsActive,
		&p.CreatedAt,
		&p.LastMovementAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to get product by id: %w", err)
	}
	return &p, nil
}

func (r *ProductRepository) Create(ctx context.Context, req model.CreateProductRequest) (*model.Product, error) {
	stock := 0
	if req.Stock != nil {
		stock = *req.Stock
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	insertQuery := `
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, sku, name, price, stock, is_active, created_at
	`
	var p model.Product
	err = tx.QueryRowContext(ctx, insertQuery, req.SKU, req.Name, *req.Price, stock, isActive).Scan(
		&p.ID,
		&p.SKU,
		&p.Name,
		&p.Price,
		&p.Stock,
		&p.IsActive,
		&p.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key value") || strings.Contains(err.Error(), "products_sku_key") {
			return nil, ErrSKUAlreadyExists
		}
		return nil, fmt.Errorf("failed to insert product: %w", err)
	}

	// If initial stock > 0, record initial stock movement
	if stock > 0 {
		movementQuery := `
			INSERT INTO stock_movements (product_id, type, qty, note, created_at)
			VALUES ($1, 'in', $2, 'Initial product creation stock', NOW())
		`
		if _, err := tx.ExecContext(ctx, movementQuery, p.ID, stock); err != nil {
			return nil, fmt.Errorf("failed to insert initial stock movement: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &p, nil
}

func (r *ProductRepository) Update(ctx context.Context, id int, req model.UpdateProductRequest) (*model.Product, error) {
	existing, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	sku := existing.SKU
	if req.SKU != "" {
		sku = req.SKU
	}
	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}
	price := existing.Price
	if req.Price != nil {
		price = *req.Price
	}
	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	updateQuery := `
		UPDATE products
		SET sku = $1, name = $2, price = $3, is_active = $4
		WHERE id = $5
		RETURNING id, sku, name, price, stock, is_active, created_at
	`
	var updated model.Product
	err = r.db.QueryRowContext(ctx, updateQuery, sku, name, price, isActive, id).Scan(
		&updated.ID,
		&updated.SKU,
		&updated.Name,
		&updated.Price,
		&updated.Stock,
		&updated.IsActive,
		&updated.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key value") || strings.Contains(err.Error(), "products_sku_key") {
			return nil, ErrSKUAlreadyExists
		}
		return nil, fmt.Errorf("failed to update product: %w", err)
	}

	updated.LastMovementAt = existing.LastMovementAt
	return &updated, nil
}

func (r *ProductRepository) Delete(ctx context.Context, id int) error {
	// First check if product exists
	var exists bool
	checkExistQuery := "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)"
	if err := r.db.QueryRowContext(ctx, checkExistQuery, id).Scan(&exists); err != nil {
		return fmt.Errorf("failed to check product existence: %w", err)
	}
	if !exists {
		return ErrProductNotFound
	}

	// Check if product has movements in stock_movements
	var movementCount int
	countQuery := "SELECT COUNT(*) FROM stock_movements WHERE product_id = $1"
	if err := r.db.QueryRowContext(ctx, countQuery, id).Scan(&movementCount); err != nil {
		return fmt.Errorf("failed to check product movement history: %w", err)
	}

	if movementCount > 0 {
		return ErrProductHasHistory
	}

	// Also check if product has order items
	var orderItemCount int
	orderCountQuery := `
		SELECT COUNT(*) 
		FROM sales_order_items soi
		JOIN products p ON soi.sku = p.sku
		WHERE p.id = $1
	`
	if err := r.db.QueryRowContext(ctx, orderCountQuery, id).Scan(&orderItemCount); err != nil {
		return fmt.Errorf("failed to check sales order items: %w", err)
	}
	if orderItemCount > 0 {
		return ErrProductHasHistory
	}

	deleteQuery := "DELETE FROM products WHERE id = $1"
	res, err := r.db.ExecContext(ctx, deleteQuery, id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrProductNotFound
	}

	return nil
}

func (r *ProductRepository) AdjustStock(ctx context.Context, id int, req model.AdjustStockRequest) (*model.Product, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Row lock with FOR UPDATE
	var currentStock int
	var sku string
	var name string
	var price int
	var isActive bool
	selectQuery := `
		SELECT sku, name, price, stock, is_active
		FROM products
		WHERE id = $1
		FOR UPDATE
	`
	err = tx.QueryRowContext(ctx, selectQuery, id).Scan(&sku, &name, &price, &currentStock, &isActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to lock product for stock adjust: %w", err)
	}

	newStock := currentStock
	if req.Type == "out" {
		if currentStock < req.Qty {
			return nil, &InsufficientStockError{
				SKU:       sku,
				Available: currentStock,
			}
		}
		newStock -= req.Qty
	} else if req.Type == "in" {
		newStock += req.Qty
	} else {
		return nil, fmt.Errorf("invalid adjustment type: %s", req.Type)
	}

	updateQuery := "UPDATE products SET stock = $1 WHERE id = $2"
	if _, err := tx.ExecContext(ctx, updateQuery, newStock, id); err != nil {
		return nil, fmt.Errorf("failed to update stock: %w", err)
	}

	movementQuery := `
		INSERT INTO stock_movements (product_id, type, qty, note, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`
	if _, err := tx.ExecContext(ctx, movementQuery, id, req.Type, req.Qty, req.Note); err != nil {
		return nil, fmt.Errorf("failed to insert stock movement: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit stock adjust transaction: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *ProductRepository) GetMovements(ctx context.Context, productID int) ([]model.StockMovement, error) {
	// First check product existence
	var exists bool
	if err := r.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)", productID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrProductNotFound
	}

	query := `
		SELECT id, product_id, type, qty, note, created_at
		FROM stock_movements
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
	`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to get movements: %w", err)
	}
	defer rows.Close()

	movements := make([]model.StockMovement, 0)
	for rows.Next() {
		var sm model.StockMovement
		if err := rows.Scan(&sm.ID, &sm.ProductID, &sm.Type, &sm.Qty, &sm.Note, &sm.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan movement: %w", err)
		}
		movements = append(movements, sm)
	}
	return movements, nil
}
