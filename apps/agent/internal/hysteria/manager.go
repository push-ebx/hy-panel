package hysteria

import (
	"fmt"
	"os"
	"os/exec"
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

func (m *Manager) SyncClients(clients []ClientConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Build userpass auth map for YAML
	userPass := make(map[string]string)
	for _, client := range clients {
		if client.Enabled {
			userPass[client.ID] = client.Password
		}
	}

	// Read existing config
	data, err := os.ReadFile(m.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	var config map[string]interface{}
	if err := yaml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	// Update auth section
	config["auth"] = map[string]interface{}{
		"type":     "userpass",
		"userpass": userPass,
	}

	// Write back
	newData, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(m.configPath, newData, 0600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return m.reload()
}

func (m *Manager) reload() error {
	cmd := exec.Command("systemctl", "restart", m.serviceName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("restart failed: %s", string(output))
	}
	return nil
}
