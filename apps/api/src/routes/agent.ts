import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, servers, clients, serverStats } from "@hy2-panel/db";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse, AgentSyncClientsPayload } from "@hy2-panel/shared";

const heartbeatSchema = z.object({
  status: z.enum(["online", "offline", "error"]),
  stats: z.object({
    uptime: z.number(),
    connections: z.number(),
    bytesIn: z.number(),
    bytesOut: z.number(),
  }),
});

export const agentRoutes = new Hono();

// Agent authentication via token
async function verifyAgentToken(token: string) {
  const db = await getDb();
  const server = await db.query.servers.findFirst({
    where: eq(servers.agentToken, token),
  });
  return server;
}

agentRoutes.post("/heartbeat", zValidator("json", heartbeatSchema), async (c) => {
  const token = c.req.header("X-Agent-Token");
  if (!token) {
    throw new ApiError(401, "Missing agent token");
  }

  const server = await verifyAgentToken(token);
  if (!server) {
    throw new ApiError(401, "Invalid agent token");
  }

  const data = c.req.valid("json");
  const db = await getDb();

  // Update server status
  await db.update(servers).set({ status: data.status }).where(eq(servers.id, server.id));

  // Record stats
  await db.insert(serverStats).values({
    id: crypto.randomUUID(),
    serverId: server.id,
    uptime: data.stats.uptime,
    connections: data.stats.connections,
    bytesIn: data.stats.bytesIn,
    bytesOut: data.stats.bytesOut,
  });

  return c.json<ApiResponse>({
    success: true,
  });
});

agentRoutes.get("/clients", async (c) => {
  const token = c.req.header("X-Agent-Token");
  if (!token) {
    throw new ApiError(401, "Missing agent token");
  }

  const server = await verifyAgentToken(token);
  if (!server) {
    throw new ApiError(401, "Invalid agent token");
  }

  const db = await getDb();
  const serverClients = await db.query.clients.findMany({
    where: eq(clients.serverId, server.id),
  });

  const payload: AgentSyncClientsPayload = {
    clients: serverClients
      .filter((c) => c.enabled && (!c.expiresAt || c.expiresAt > new Date()))
      .map((c) => ({
        password: c.password,
        uploadLimit: c.uploadLimit,
        downloadLimit: c.downloadLimit,
        totalLimit: c.totalLimit,
        enabled: c.enabled,
      })),
  };

  return c.json<ApiResponse<AgentSyncClientsPayload>>({
    success: true,
    data: payload,
  });
});

agentRoutes.get("/config", async (c) => {
  const token = c.req.header("X-Agent-Token");
  if (!token) {
    throw new ApiError(401, "Missing agent token");
  }

  const server = await verifyAgentToken(token);
  if (!server) {
    throw new ApiError(401, "Invalid agent token");
  }

  return c.json<ApiResponse>({
    success: true,
    data: server.config,
  });
});
