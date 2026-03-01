package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/hy2-panel/agent/internal/config"
	"github.com/hy2-panel/agent/internal/hysteria"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	hy2Manager := hysteria.NewManager(cfg.Hy2ConfigPath, cfg.Hy2ServiceName)

	mux := http.NewServeMux()

	// Auth middleware
	authMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			if token != "Bearer "+cfg.AgentToken {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			next(w, r)
		}
	}

	// Export current clients from config
	mux.HandleFunc("GET /export", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		clients, err := hy2Manager.ReadClients()
		if err != nil {
			log.Printf("Export failed: %v", err)
			http.Error(w, "Export failed", http.StatusInternalServerError)
			return
		}

		log.Printf("Exported %d clients from config", len(clients))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"clients": clients})
	}))

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		log.Printf("Agent HTTP server running on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down agent...")
	server.Close()
}
