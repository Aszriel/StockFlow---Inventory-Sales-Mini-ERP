package middleware

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/cors"
)

func CorsMiddleware(allowedOriginsStr string) func(http.Handler) http.Handler {
	origins := strings.Split(allowedOriginsStr, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	if len(origins) == 0 || origins[0] == "" {
		origins = []string{"*"}
	}

	return cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
		duration := time.Since(start)

		log.Printf("[%s] %s %d %s", r.Method, r.RequestURI, rw.statusCode, duration)
	})
}
