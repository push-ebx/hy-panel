package hysteria

import (
	"fmt"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

type Manager struct {
	configPath  string
	serviceName string
	mu          sync.Mutex
}

type ClientConfig struct {
	ID       string `json:"id"`
	Password string `json:"password"`
	Enabled  bool   `json:"enabled"`
}

// Hysteria2 config structure
type Hy2Config struct {
	Auth struct {
		Type     string            `yaml:"type"`
		UserPass map[string]string `yaml:"userpass"`
	} `yaml:"auth"`
}

func NewManager(configPath, serviceName string) *Manager {
	return &Manager{
		configPath:  configPath,
		serviceName: serviceName,
	}
}

// ReadClients reads existing clients from Hysteria2 config
func (m *Manager) ReadClients() ([]ClientConfig, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(m.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config Hy2Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	var clients []ClientConfig
	for name, password := range config.Auth.UserPass {
		clients = append(clients, ClientConfig{
			ID:       name,
			Password: password,
			Enabled:  true,
		})
	}

	return clients, nil
}
