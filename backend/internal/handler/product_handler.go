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

type ProductHandler struct {
	repo *repository.ProductRepository
}

func NewProductHandler(repo *repository.ProductRepository) *ProductHandler {
	return &ProductHandler{repo: repo}
}

func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	filter := strings.TrimSpace(r.URL.Query().Get("filter"))

	filterObj := model.ProductFilter{
		Page:   page,
		Limit:  limit,
		Search: search,
		Filter: filter,
	}

	result, err := h.repo.List(r.Context(), filterObj)
	if err != nil {
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, result)
}

func (h *ProductHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.repo.GetSummary(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	JSON(w, http.StatusOK, summary)
}

func (h *ProductHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid product ID")
		return
	}

	product, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Product not found")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, product)
}

func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON payload")
		return
	}

	req.SKU = strings.TrimSpace(req.SKU)
	req.Name = strings.TrimSpace(req.Name)

	if req.SKU == "" {
		ValidationError(w, "sku", "SKU is required")
		return
	}
	if req.Name == "" {
		ValidationError(w, "name", "Product name is required")
		return
	}
	if req.Price == nil {
		ValidationError(w, "price", "Price is required")
		return
	}
	if *req.Price < 0 {
		ValidationError(w, "price", "Price must be greater than or equal to 0")
		return
	}
	if req.Stock != nil && *req.Stock < 0 {
		ValidationError(w, "stock", "Stock must be greater than or equal to 0")
		return
	}

	created, err := h.repo.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, repository.ErrSKUAlreadyExists) {
			Error(w, http.StatusConflict, "SKU_ALREADY_EXISTS", "A product with this SKU already exists")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusCreated, created)
}

func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid product ID")
		return
	}

	var req model.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON payload")
		return
	}

	req.SKU = strings.TrimSpace(req.SKU)
	req.Name = strings.TrimSpace(req.Name)

	if req.SKU == "" {
		ValidationError(w, "sku", "SKU cannot be empty")
		return
	}
	if req.Name == "" {
		ValidationError(w, "name", "Product name cannot be empty")
		return
	}
	if req.Price != nil && *req.Price < 0 {
		ValidationError(w, "price", "Price must be greater than or equal to 0")
		return
	}

	updated, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Product not found")
			return
		}
		if errors.Is(err, repository.ErrSKUAlreadyExists) {
			Error(w, http.StatusConflict, "SKU_ALREADY_EXISTS", "A product with this SKU already exists")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, updated)
}

func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid product ID")
		return
	}

	err = h.repo.Delete(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Product not found")
			return
		}
		if errors.Is(err, repository.ErrProductHasHistory) {
			model.RespondWithError(w, http.StatusConflict, model.ErrorDetail{
				Code:    "PRODUCT_HAS_HISTORY",
				Message: "Cannot delete product because it has stock movement or order history",
			})
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "Product deleted successfully"})
}

func (h *ProductHandler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid product ID")
		return
	}

	var req model.AdjustStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON payload")
		return
	}

	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "in" && req.Type != "out" {
		ValidationError(w, "type", "Type must be either 'in' or 'out'")
		return
	}
	if req.Qty <= 0 {
		ValidationError(w, "qty", "Quantity must be greater than 0")
		return
	}

	updated, err := h.repo.AdjustStock(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Product not found")
			return
		}
		var insErr *repository.InsufficientStockError
		if errors.As(err, &insErr) {
			InsufficientStockError(w, insErr.SKU, insErr.Available)
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, updated)
}

func (h *ProductHandler) GetMovements(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		ValidationError(w, "id", "Invalid product ID")
		return
	}

	movements, err := h.repo.GetMovements(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			Error(w, http.StatusNotFound, "NOT_FOUND", "Product not found")
			return
		}
		Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	JSON(w, http.StatusOK, movements)
}
