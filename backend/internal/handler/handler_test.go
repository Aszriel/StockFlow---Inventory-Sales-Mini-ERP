package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"stockflow-backend/internal/handler"
	"stockflow-backend/internal/model"
)

func TestValidationErrors(t *testing.T) {
	rec := httptest.NewRecorder()
	handler.ValidationError(rec, "sku", "SKU is required")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}

	var resp model.ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected error code VALIDATION_ERROR, got %s", resp.Error.Code)
	}
	if resp.Error.Field != "sku" {
		t.Errorf("expected field sku, got %s", resp.Error.Field)
	}
}

func TestInsufficientStockErrorEnvelope(t *testing.T) {
	rec := httptest.NewRecorder()
	handler.InsufficientStockError(rec, "ELEC-KB-001", 3)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d", rec.Code)
	}

	var resp model.ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Error.Code != "INSUFFICIENT_STOCK" {
		t.Errorf("expected error code INSUFFICIENT_STOCK, got %s", resp.Error.Code)
	}
	if resp.Error.SKU != "ELEC-KB-001" {
		t.Errorf("expected sku ELEC-KB-001, got %s", resp.Error.SKU)
	}
	if resp.Error.Available == nil || *resp.Error.Available != 3 {
		t.Errorf("expected available stock 3, got %v", resp.Error.Available)
	}
}

func TestCreateOrderValidation(t *testing.T) {
	h := handler.NewOrderHandler(nil)

	// Test empty customer
	reqBody, _ := json.Marshal(model.CreateOrderRequest{
		Customer: "",
		Items:    []model.OrderItemRequest{{SKU: "TEST-01", Qty: 1}},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(reqBody))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for empty customer, got %d", rec.Code)
	}

	var resp model.ErrorResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Error.Field != "customer" {
		t.Errorf("expected field customer, got %s", resp.Error.Field)
	}

	// Test duplicate SKU
	reqBody, _ = json.Marshal(model.CreateOrderRequest{
		Customer: "Acme",
		Items: []model.OrderItemRequest{
			{SKU: "TEST-01", Qty: 1},
			{SKU: "TEST-01", Qty: 2},
		},
	})
	req = httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(reqBody))
	rec = httptest.NewRecorder()

	h.Create(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for duplicate SKU, got %d", rec.Code)
	}
}
