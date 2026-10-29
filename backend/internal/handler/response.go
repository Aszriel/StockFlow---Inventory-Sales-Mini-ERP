package handler

import (
	"encoding/json"
	"net/http"

	"stockflow-backend/internal/model"
)

func JSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func Error(w http.ResponseWriter, statusCode int, code, message string) {
	model.RespondWithError(w, statusCode, model.ErrorDetail{
		Code:    code,
		Message: message,
	})
}

func ValidationError(w http.ResponseWriter, field, message string) {
	model.RespondWithError(w, http.StatusBadRequest, model.ErrorDetail{
		Code:    "VALIDATION_ERROR",
		Message: message,
		Field:   field,
	})
}

func InsufficientStockError(w http.ResponseWriter, sku string, available int) {
	model.RespondWithError(w, http.StatusConflict, model.ErrorDetail{
		Code:      "INSUFFICIENT_STOCK",
		Message:   "Stock is not sufficient for requested quantity",
		SKU:       sku,
		Available: &available,
	})
}
