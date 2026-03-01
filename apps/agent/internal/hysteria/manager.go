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

// AddClient adds or updates a client in the Hysteria2 config (auth.userpass) and writes the file back.
func (m *Manager) AddClient(id, password string) error {
	if id == "" || password == "" {
		return fmt.Errorf("id and password are required")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(m.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	var raw map[interface{}]interface{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	auth, _ := raw["auth"].(map[interface{}]interface{})
	if auth == nil {
		auth = map[interface{}]interface{}{
			"type": "userpass",
			"userpass": map[interface{}]interface{}{},
		}
		raw["auth"] = auth
	}

	if auth["type"] == nil {
		auth["type"] = "userpass"
	}

	userpass, _ := auth["userpass"].(map[interface{}]interface{})
	if userpass == nil {
		userpass = make(map[interface{}]interface{})
		auth["userpass"] = userpass
	}

	userpass[id] = password

	out, err := yaml.Marshal(raw)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(m.configPath, out, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}
