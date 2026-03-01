package ws

import (
	"encoding/json"
	"log"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hy2-panel/agent/internal/api"
)

type Client struct {
	endpoint         string
	token            string
	conn             *websocket.Conn
	mu               sync.Mutex
	done             chan struct{}
	syncHandler      func()
	heartbeatHandler func() api.StatsData
}

type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

func NewClient(endpoint, token string, syncHandler func(), heartbeatHandler func() api.StatsData) *Client {
	return &Client{
		endpoint:         endpoint,
		token:            token,
		done:             make(chan struct{}),
		syncHandler:      syncHandler,
		heartbeatHandler: heartbeatHandler,
	}
}

func (c *Client) Connect() {
	for {
		select {
		case <-c.done:
			return
		default:
			c.connect()
			// Wait before reconnecting
			time.Sleep(5 * time.Second)
		}
	}
}

func (c *Client) connect() {
	u, err := url.Parse(c.endpoint)
	if err != nil {
		log.Printf("Invalid WebSocket URL: %v", err)
		return
	}

	q := u.Query()
	q.Set("token", c.token)
	u.RawQuery = q.Encode()

	log.Printf("Connecting to %s", u.String())

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Printf("WebSocket connection failed: %v", err)
		return
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	log.Println("WebSocket connected")

	// Start heartbeat goroutine
	go c.heartbeatLoop()

	// Read messages
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Invalid message: %v", err)
			continue
		}

		c.handleMessage(msg)
	}

	c.mu.Lock()
	c.conn = nil
	c.mu.Unlock()
}

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case "sync":
		// Panel requests sync
		go c.syncHandler()

	case "pong":
		// Heartbeat response, ignore

	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

func (c *Client) heartbeatLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			c.sendHeartbeat()
		}
	}
}

func (c *Client) sendHeartbeat() {
	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()

	if conn == nil {
		return
	}

	stats := c.heartbeatHandler()

	msg := map[string]interface{}{
		"type": "heartbeat",
		"data": stats,
	}

	data, _ := json.Marshal(msg)

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("Failed to send heartbeat: %v", err)
	}
}

func (c *Client) Close() {
	close(c.done)

	c.mu.Lock()
	if c.conn != nil {
		c.conn.Close()
	}
	c.mu.Unlock()
}
