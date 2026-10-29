package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"stockflow-backend/internal/config"
	"stockflow-backend/internal/handler"
	"stockflow-backend/internal/middleware"
	"stockflow-backend/internal/repository"
)

func main() {
	cfg := config.LoadConfig()

	// Connect to database with retry
	var db *sql.DB
	var err error
	maxRetries := 10
	for i := 1; i <= maxRetries; i++ {
		db, err = repository.NewDB(cfg)
		if err == nil {
			break
		}
		log.Printf("Waiting for database connection (attempt %d/%d): %v", i, maxRetries, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Could not connect to database after %d attempts: %v", maxRetries, err)
	}
	defer db.Close()

	// Initialize repositories
	productRepo := repository.NewProductRepository(db)
	orderRepo := repository.NewOrderRepository(db)

	// Initialize handlers
	productHandler := handler.NewProductHandler(productRepo)
	orderHandler := handler.NewOrderHandler(orderRepo)

	// Router setup
	r := chi.NewRouter()

	// Middlewares
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(middleware.LoggingMiddleware)
	r.Use(middleware.CorsMiddleware(cfg.CORSAllowedOrigins))

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		handler.JSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Product routes
		r.Route("/products", func(r chi.Router) {
			r.Get("/", productHandler.List)
			r.Post("/", productHandler.Create)
			r.Get("/summary", productHandler.GetSummary)
			r.Get("/{id}", productHandler.GetByID)
			r.Put("/{id}", productHandler.Update)
			r.Delete("/{id}", productHandler.Delete)
			r.Post("/{id}/stock", productHandler.AdjustStock)
			r.Get("/{id}/movements", productHandler.GetMovements)
		})

		// Order routes
		r.Route("/orders", func(r chi.Router) {
			r.Get("/", orderHandler.List)
			r.Post("/", orderHandler.Create)
			r.Get("/{id}", orderHandler.GetByID)
			r.Post("/{id}/cancel", orderHandler.Cancel)
		})
	})

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown channel
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("StockFlow Backend API server starting on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	<-shutdownChan
	log.Println("Shutting down server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server gracefully stopped")
}
