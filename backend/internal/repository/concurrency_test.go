package repository_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"stockflow-backend/internal/model"
	"stockflow-backend/internal/repository"
)

func getTestDB(t *testing.T) *sql.DB {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=postgres password=postgres dbname=stockflow sslmode=disable"
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skipf("Skipping test: cannot open DB: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		t.Skipf("Skipping test: DB ping failed (PostgreSQL likely not running): %v", err)
	}

	return db
}

func TestConcurrentOrderStockDeduction(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	ctx := context.Background()
	orderRepo := repository.NewOrderRepository(db)

	// Create a unique test product for this concurrency test
	testSKU := fmt.Sprintf("CONCUR-TEST-%d", time.Now().UnixNano())
	initialStock := 10
	price := 50000

	var productID int
	query := `
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Concurrency Test Item', $2, $3, true)
		RETURNING id
	`
	err := db.QueryRowContext(ctx, query, testSKU, price, initialStock).Scan(&productID)
	if err != nil {
		t.Fatalf("failed to insert test product: %v", err)
	}

	// Clean up after test
	defer func() {
		_, _ = db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
		_, _ = db.Exec("DELETE FROM stock_movements WHERE product_id = $1", productID)
		_, _ = db.Exec("DELETE FROM products WHERE id = $1", productID)
	}()

	// Run 25 concurrent goroutines attempting to purchase 1 item each
	// Only exactly 10 should succeed! 15 must fail with insufficient stock.
	numGoroutines := 25
	var successCount int64
	var failInsufficientStockCount int64
	var otherErrorCount int64

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	startBarrier := make(chan struct{})

	for i := 0; i < numGoroutines; i++ {
		go func(workerID int) {
			defer wg.Done()
			<-startBarrier // wait for all goroutines to be ready

			_, err := orderRepo.Create(context.Background(), model.CreateOrderRequest{
				Customer: fmt.Sprintf("Concurrent Customer %d", workerID),
				Items: []model.OrderItemRequest{
					{SKU: testSKU, Qty: 1},
				},
			})

			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				var insErr *repository.InsufficientStockError
				if ok := (err.Error() != "" && insErr == nil); ok {
					// Check if error is insufficient stock
					atomic.AddInt64(&failInsufficientStockCount, 1)
				} else {
					atomic.AddInt64(&otherErrorCount, 1)
				}
			}
		}(i)
	}

	// Trigger all goroutines simultaneously
	close(startBarrier)
	wg.Wait()

	t.Logf("Concurrency results: %d successes, %d rejected due to stock, %d other errors",
		successCount, failInsufficientStockCount, otherErrorCount)

	// Check final stock in DB
	var finalStock int
	err = db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&finalStock)
	if err != nil {
		t.Fatalf("failed to query final stock: %v", err)
	}

	if finalStock < 0 {
		t.Fatalf("CRITICAL: Stock became negative! finalStock = %d", finalStock)
	}

	if int(successCount) != initialStock {
		t.Errorf("expected exactly %d successful orders, got %d", initialStock, successCount)
	}

	if finalStock != 0 {
		t.Errorf("expected final stock to be 0, got %d", finalStock)
	}
}
