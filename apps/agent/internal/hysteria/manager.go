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

// toStrMap converts map[interface{}]interface{} (from yaml.Unmarshal) to map[string]interface{}
// so that yaml.Marshal emits all keys correctly. Recurses into nested maps and slices.
func toStrMap(v interface{}) interface{} {
	switch x := v.(type) {
	case map[interface{}]interface{}:
		out := make(map[string]interface{}, len(x))
		for k, val := range x {
			key, ok := k.(string)
			if !ok {
				key = fmt.Sprint(k)
			}
			out[key] = toStrMap(val)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(x))
		for i, val := range x {
			out[i] = toStrMap(val)
		}
		return out
	default:
		return v
	}
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

	// Convert to map[string]interface{} so Marshal won't drop keys
	cfg, _ := toStrMap(raw).(map[string]interface{})
	if cfg == nil {
		cfg = make(map[string]interface{})
	}

	auth, _ := cfg["auth"].(map[string]interface{})
	if auth == nil {
		auth = map[string]interface{}{
			"type":     "userpass",
			"userpass": map[string]interface{}{},
		}
		cfg["auth"] = auth
	}

	if auth["type"] == nil {
		auth["type"] = "userpass"
	}

	userpass, _ := auth["userpass"].(map[string]interface{})
	if userpass == nil {
		userpass = make(map[string]interface{})
		auth["userpass"] = userpass
	}

	userpass[id] = password

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(m.configPath, out, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return m.restartService()
}

// RemoveClient removes a client from the Hysteria2 config (auth.userpass) and writes the file back.
func (m *Manager) RemoveClient(id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
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

	cfg, _ := toStrMap(raw).(map[string]interface{})
	if cfg == nil {
		return fmt.Errorf("config is empty")
	}

	auth, _ := cfg["auth"].(map[string]interface{})
	if auth == nil {
		return fmt.Errorf("auth section not found")
	}

	userpass, _ := auth["userpass"].(map[string]interface{})
	if userpass == nil {
		return fmt.Errorf("user not found")
	}

	if _, ok := userpass[id]; !ok {
		return fmt.Errorf("user not found")
	}

	delete(userpass, id)

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(m.configPath, out, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return m.restartService()
}

// restartService runs systemctl restart for the Hysteria2 service. No-op if serviceName is empty.
func (m *Manager) restartService() error {
	if m.serviceName == "" {
		return nil
	}
	cmd := exec.Command("systemctl", "restart", m.serviceName)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl restart %s: %w: %s", m.serviceName, err, string(out))
	}
	return nil
}
