package model

import (
	"encoding/json"
	"net/http"
)

type ErrorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Field     string `json:"field,omitempty"`
	SKU       string `json:"sku,omitempty"`
	Available *int   `json:"available,omitempty"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

func NewAppError(code, message string) *ErrorDetail {
	return &ErrorDetail{
		Code:    code,
		Message: message,
	}
}

func (e *ErrorDetail) WithField(field string) *ErrorDetail {
	e.Field = field
	return e
}

func (e *ErrorDetail) WithSKUAndStock(sku string, available int) *ErrorDetail {
	e.SKU = sku
	e.Available = &available
	return e
}

func RespondWithError(w http.ResponseWriter, statusCode int, errDetail ErrorDetail) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: errDetail})
}
