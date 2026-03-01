package hysteria

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
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

type Hy2UserPass struct {
	Password string `json:"password"`
}

func NewManager(configPath, serviceName string) *Manager {
	return &Manager{
		configPath:  configPath,
		serviceName: serviceName,
	}
}

func (m *Manager) SyncClients(clients []ClientConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Build userpass auth list
	var userPassList []Hy2UserPass
	for _, client := range clients {
		if client.Enabled {
			userPassList = append(userPassList, Hy2UserPass{
				Password: client.Password,
			})
		}
	}

	// Write to auth file
	authFilePath := m.configPath + ".auth.json"
	authData, err := json.MarshalIndent(userPassList, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal auth config: %w", err)
	}

	if err := os.WriteFile(authFilePath, authData, 0600); err != nil {
		return fmt.Errorf("failed to write auth config: %w", err)
	}

	return m.reload()
}

func (m *Manager) reload() error {
	cmd := exec.Command("systemctl", "reload", m.serviceName)
	if err := cmd.Run(); err != nil {
		cmd = exec.Command("systemctl", "restart", m.serviceName)
		return cmd.Run()
	}
	return nil
}
