package hysteria

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/hy2-panel/agent/internal/api"
)

type Manager struct {
	configPath string
	binaryPath string
	startTime  time.Time
	stats      api.StatsData
	mu         sync.RWMutex
}

type Hy2AuthConfig struct {
	Type   string          `json:"type"`
	HTTP   Hy2HTTPAuth     `json:"http,omitempty"`
	UserPass []Hy2UserPass `json:"userpass,omitempty"`
}

type Hy2HTTPAuth struct {
	URL      string `json:"url"`
	Insecure bool   `json:"insecure"`
}

type Hy2UserPass struct {
	Password string `json:"password"`
}

func NewManager(configPath, binaryPath string) *Manager {
	return &Manager{
		configPath: configPath,
		binaryPath: binaryPath,
		startTime:  time.Now(),
	}
}

func (m *Manager) GetStats() api.StatsData {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return api.StatsData{
		Uptime:      int64(time.Since(m.startTime).Seconds()),
		Connections: m.stats.Connections,
		BytesIn:     m.stats.BytesIn,
		BytesOut:    m.stats.BytesOut,
	}
}

func (m *Manager) SyncClients(clients []api.ClientConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Build userpass auth config
	var userPassList []Hy2UserPass
	for _, client := range clients {
		if client.Enabled {
			userPassList = append(userPassList, Hy2UserPass{
				Password: client.Password,
			})
		}
	}

	// Write to auth file (separate from main config)
	authFilePath := m.configPath + ".auth.json"
	authData, err := json.MarshalIndent(userPassList, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal auth config: %w", err)
	}

	if err := os.WriteFile(authFilePath, authData, 0600); err != nil {
		return fmt.Errorf("failed to write auth config: %w", err)
	}

	// Reload hysteria2 config
	return m.reload()
}

func (m *Manager) reload() error {
	// Send SIGHUP to hysteria2 process to reload config
	cmd := exec.Command("pkill", "-HUP", "hysteria")
	return cmd.Run()
}

func (m *Manager) UpdateStats(connections int, bytesIn, bytesOut int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stats.Connections = connections
	m.stats.BytesIn = bytesIn
	m.stats.BytesOut = bytesOut
}
