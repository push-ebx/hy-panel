package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	endpoint   string
	token      string
	httpClient *http.Client
}

type HeartbeatPayload struct {
	Status string     `json:"status"`
	Stats  StatsData  `json:"stats"`
}

type StatsData struct {
	Uptime      int64 `json:"uptime"`
	Connections int   `json:"connections"`
	BytesIn     int64 `json:"bytesIn"`
	BytesOut    int64 `json:"bytesOut"`
}

type ClientConfig struct {
	Password      string `json:"password"`
	UploadLimit   int64  `json:"uploadLimit"`
	DownloadLimit int64  `json:"downloadLimit"`
	TotalLimit    int64  `json:"totalLimit"`
	Enabled       bool   `json:"enabled"`
}

type ClientsResponse struct {
	Success bool           `json:"success"`
	Data    ClientsPayload `json:"data"`
}

type ClientsPayload struct {
	Clients []ClientConfig `json:"clients"`
}

func NewClient(endpoint, token string) *Client {
	return &Client{
		endpoint: endpoint,
		token:    token,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) SendHeartbeat(stats StatsData) error {
	payload := HeartbeatPayload{
		Status: "online",
		Stats:  stats,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal heartbeat: %w", err)
	}

	req, err := http.NewRequest("POST", c.endpoint+"/api/agent/heartbeat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send heartbeat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed with status: %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) GetClients() ([]ClientConfig, error) {
	req, err := http.NewRequest("GET", c.endpoint+"/api/agent/clients", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-Agent-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get clients failed with status: %d", resp.StatusCode)
	}

	var response ClientsResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return response.Data.Clients, nil
}
