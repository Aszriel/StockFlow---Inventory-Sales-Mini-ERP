package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"stockflow-backend/internal/model"
	"stockflow-backend/internal/repository"
)

type OrderHandler struct {
	repo *repository.OrderRepository
}

func NewOrderHandler(repo *repository.OrderRepository) *OrderHandler {
	return &OrderHandler{repo: repo}
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON payload")
		return
	}

	req.Customer = strings.TrimSpace(req.Customer)
	if req.Customer == "" {
		ValidationError(w, "customer", "Customer name is required")
		return
	}

	if len(req.Items) == 0 {
		ValidationError(w, "items", "Order must contain at least one item")
		return
	}

	// Validate duplicate SKUs in request & qty > 0
	seenSKUs := make(map[string]bool)
	for i, item := range req.Items {
		sku := strings.TrimSpace(item.SKU)
		req.Items[i].SKU = sku

		if sku == "" {
			ValidationError(w, "items", "SKU is required for all items")
			return
		}
		if item.Qty <= 0 {
			ValidationError(w, "items", "Quantity must be greater than 0")
			return
		}
		if seenSKUs[sku] {
			ValidationError(w, "items", "Duplicate SKU found in order items: "+sku)
			return
		}
		seenSKUs[sku] = true
	}

	order, err := h.repo.Create(r.Context(), req)
	if err != nil {
		var insErr *repository.InsufficientStockError
		if errors.As(err, &insErr) {
			InsufficientStockError(w, insErr.SKU, insErr.Available)
			return
		}
		if errors.Is(err, repository.ErrProductInactive) {
			Error(w, http.StatusBadRequest, "PRODUCT_INACTIVE", err.Error())
			return
		}
		if strings.Contains(err.Error(), "product not found for SKU") {
			Error(w, http.StatusBadRequest, "PRODUCT_NOT_FOUND", err.Error())
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusCreated, order)
}

func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
	orders, err := h.repo.List(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	JSON(w, http.StatusOK, orders)
}

func (h *OrderHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid order ID")
		return
	}

	order, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Order not found")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, order)
}

func (h *OrderHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid order ID")
		return
	}

	order, err := h.repo.Cancel(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Order not found")
			return
		}
		if errors.Is(err, repository.ErrOrderAlreadyCancelled) {
			Error(w, http.StatusConflict, "ORDER_ALREADY_CANCELLED", "Order has already been cancelled")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, order)
}
