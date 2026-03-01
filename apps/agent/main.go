package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/hy2-panel/agent/internal/api"
	"github.com/hy2-panel/agent/internal/config"
	"github.com/hy2-panel/agent/internal/hysteria"
	"github.com/hy2-panel/agent/internal/ws"
)

func main() {
	// Load .env file
	_ = godotenv.Load()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize API client (for HTTP fallback)
	apiClient := api.NewClient(cfg.APIEndpoint, cfg.AgentToken)

	// Initialize Hysteria2 manager
	hy2Manager := hysteria.NewManager(cfg.Hy2ConfigPath, cfg.Hy2BinaryPath)

	// Sync handler
	syncHandler := func() {
		log.Println("Syncing clients...")
		clients, err := apiClient.GetClients()
		if err != nil {
			log.Printf("Failed to get clients: %v", err)
			return
		}
		err = hy2Manager.SyncClients(clients)
		if err != nil {
			log.Printf("Failed to sync clients: %v", err)
			return
		}
		log.Printf("Synced %d clients", len(clients))
	}

	// Heartbeat handler
	heartbeatHandler := func() api.StatsData {
		return hy2Manager.GetStats()
	}

	// Create WebSocket client
	wsClient := ws.NewClient(cfg.WSEndpoint, cfg.AgentToken, syncHandler, heartbeatHandler)

	// Start WebSocket connection (with auto-reconnect)
	go wsClient.Connect()

	log.Println("Agent started successfully")

	// Wait for termination signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down agent...")
	wsClient.Close()
}
