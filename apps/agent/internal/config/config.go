package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port           string
	AgentToken     string
	Hy2ConfigPath  string
	Hy2ServiceName string
	Hy2ApiUrl      string // Hysteria2 Traffic Stats API base URL (e.g. http://127.0.0.1:9999)
	Hy2ApiSecret   string // Optional: Authorization header value for Traffic Stats API
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		AgentToken:     os.Getenv("AGENT_TOKEN"),
		Hy2ConfigPath:  getEnv("HY2_CONFIG_PATH", "/etc/hysteria/config.yaml"),
		Hy2ServiceName: getEnv("HY2_SERVICE_NAME", "hysteria-server"),
		Hy2ApiUrl:      getEnv("HY2_API_URL", ""),
		Hy2ApiSecret:   os.Getenv("HY2_API_SECRET"),
	}

	if cfg.AgentToken == "" {
		return nil, fmt.Errorf("AGENT_TOKEN is required")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
