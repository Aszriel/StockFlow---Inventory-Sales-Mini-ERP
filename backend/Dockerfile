# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install git and certs
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o stockflow-api ./cmd/server

# Final minimal stage
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/stockflow-api /app/stockflow-api

EXPOSE 8080

CMD ["/app/stockflow-api"]
