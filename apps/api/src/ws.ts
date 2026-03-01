import { WebSocketServer, WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { getDb, servers } from "@hy2-panel/db";

// Map: serverId -> WebSocket connection
const agentConnections = new Map<string, WebSocket>();

let wss: WebSocketServer | null = null;

export function initWebSocket(port: number) {
  wss = new WebSocketServer({ port });

  console.log(`WebSocket server running on ws://localhost:${port}`);

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://localhost:${port}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    // Verify agent token
    const db = await getDb();
    const server = await db.query.servers.findFirst({
      where: eq(servers.agentToken, token),
    });

    if (!server) {
      ws.close(4002, "Invalid token");
      return;
    }

    console.log(`Agent connected: ${server.name} (${server.id})`);

    // Store connection
    agentConnections.set(server.id, ws);

    // Update server status
    await db.update(servers).set({ status: "online" }).where(eq(servers.id, server.id));

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "heartbeat") {
          // Handle heartbeat
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        console.error("Invalid message:", err);
      }
    });

    ws.on("close", async () => {
      console.log(`Agent disconnected: ${server.name}`);
      agentConnections.delete(server.id);

      // Update server status
      const db = await getDb();
      await db.update(servers).set({ status: "offline" }).where(eq(servers.id, server.id));
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error for ${server.name}:`, err);
    });

    // Send initial sync command
    ws.send(JSON.stringify({ type: "sync" }));
  });
}

// Notify agent to sync clients
export function notifyServerSync(serverId: string) {
  const ws = agentConnections.get(serverId);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "sync" }));
    console.log(`Sync command sent to server: ${serverId}`);
  } else {
    console.log(`Agent not connected for server: ${serverId}`);
  }
}

// Get connected agents count
export function getConnectedAgentsCount(): number {
  return agentConnections.size;
}

// Check if agent is connected
export function isAgentConnected(serverId: string): boolean {
  const ws = agentConnections.get(serverId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}
