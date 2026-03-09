package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/hy2-panel/agent/internal/config"
	"github.com/hy2-panel/agent/internal/hysteria"
	"github.com/hy2-panel/agent/internal/system"
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

	// Create client in config (add to auth.userpass)
	mux.HandleFunc("POST /clients", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "Content-Type must be application/json", http.StatusBadRequest)
			return
		}

		var body struct {
			ID       string `json:"id"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if body.ID == "" || body.Password == "" {
			http.Error(w, "id and password are required", http.StatusBadRequest)
			return
		}

		if err := hy2Manager.AddClient(body.ID, body.Password); err != nil {
			log.Printf("AddClient failed: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("Added client %q to config and restarted service", body.ID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":       body.ID,
			"password": body.Password,
		})
	}))

	// Online clients from Hysteria2 Traffic Stats API (GET /online)
	mux.HandleFunc("GET /online", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if cfg.Hy2ApiUrl == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]int{})
			return
		}

		req, err := http.NewRequest(http.MethodGet, cfg.Hy2ApiUrl+"/online", nil)
		if err != nil {
			http.Error(w, "Failed to build request", http.StatusInternalServerError)
			return
		}
		if cfg.Hy2ApiSecret != "" {
			req.Header.Set("Authorization", cfg.Hy2ApiSecret)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("Hy2 API /online request failed: %v (check HY2_API_URL and trafficStats in Hysteria2 config)", err)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]int{})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("Hy2 API /online returned %d: %s", resp.StatusCode, string(body))
			http.Error(w, "Upstream error", resp.StatusCode)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	}))

	// Traffic stats from Hysteria2 Traffic Stats API (GET /traffic)
	mux.HandleFunc("GET /traffic", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if cfg.Hy2ApiUrl == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{})
			return
		}

		req, err := http.NewRequest(http.MethodGet, cfg.Hy2ApiUrl+"/traffic", nil)
		if err != nil {
			http.Error(w, "Failed to build request", http.StatusInternalServerError)
			return
		}
		if cfg.Hy2ApiSecret != "" {
			req.Header.Set("Authorization", cfg.Hy2ApiSecret)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("Hy2 API /traffic request failed: %v", err)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("Hy2 API /traffic returned %d: %s", resp.StatusCode, string(body))
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	}))

	// Live streams from Hysteria2 Traffic Stats API (GET /dump/streams)
	mux.HandleFunc("GET /streams", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if cfg.Hy2ApiUrl == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"streams": []interface{}{}})
			return
		}

		req, err := http.NewRequest(http.MethodGet, cfg.Hy2ApiUrl+"/dump/streams", nil)
		if err != nil {
			http.Error(w, "Failed to build request", http.StatusInternalServerError)
			return
		}
		if cfg.Hy2ApiSecret != "" {
			req.Header.Set("Authorization", cfg.Hy2ApiSecret)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("Hy2 API /dump/streams request failed: %v", err)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"streams": []interface{}{}})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("Hy2 API /dump/streams returned %d: %s", resp.StatusCode, string(body))
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"streams": []interface{}{}})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	}))

	// Delete client from config (remove from auth.userpass)
	mux.HandleFunc("DELETE /clients/{id}", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if err := hy2Manager.RemoveClient(id); err != nil {
			log.Printf("RemoveClient failed: %v", err)
			status := http.StatusInternalServerError
			if err.Error() == "user not found" {
				status = http.StatusNotFound
			}
			http.Error(w, err.Error(), status)
			return
		}

		log.Printf("Removed client %q from config and restarted service", id)
		w.WriteHeader(http.StatusNoContent)
	}))

	// System stats (CPU, RAM, swap, disk)
	mux.HandleFunc("GET /system", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		stats, err := system.Collect("")
		if err != nil {
			log.Printf("System stats failed: %v", err)
			http.Error(w, "Failed to collect system stats", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
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
