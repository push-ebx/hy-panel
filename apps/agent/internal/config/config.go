package config

import (
	"fmt"
	"os"
)

type Config struct {
	APIEndpoint   string
	WSEndpoint    string
	AgentToken    string
	Hy2ConfigPath string
	Hy2BinaryPath string
}

func Load() (*Config, error) {
	cfg := &Config{
		APIEndpoint:   getEnv("API_ENDPOINT", "http://localhost:4000"),
		WSEndpoint:    getEnv("WS_ENDPOINT", "ws://localhost:4001"),
		AgentToken:    os.Getenv("AGENT_TOKEN"),
		Hy2ConfigPath: getEnv("HY2_CONFIG_PATH", "/etc/hysteria/config.yaml"),
		Hy2BinaryPath: getEnv("HY2_BINARY_PATH", "/usr/local/bin/hysteria"),
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
