import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, servers, clients } from "@hy2-panel/db";
import { authMiddleware, type JwtPayload } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";

const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1),
  agentUrl: z.string().min(1),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  host: z.string().min(1).optional(),
  agentUrl: z.string().min(1).optional(),
});

export const serversRoutes = new Hono();

serversRoutes.use("*", authMiddleware);

// Check status of all servers (GET /health on each agent), update status in DB
serversRoutes.post("/check-status", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    agentUrl = agentUrl.replace(/\/$/, "");

    try {
      const response = await fetch(`${agentUrl}/health`);
      await db
        .update(servers)
        .set({ status: response.ok ? "online" : "error" })
        .where(eq(servers.id, server.id));
    } catch {
      await db.update(servers).set({ status: "error" }).where(eq(servers.id, server.id));
    }
  }

  const updated = await db.query.servers.findMany();
  return c.json<ApiResponse>({
    success: true,
    data: updated,
    message: "Status updated",
  });
});

// Sync all servers - import clients from agent configs to DB
serversRoutes.post("/sync", async (c) => {
  const user = c.get("user") as JwtPayload;
  const db = await getDb();
  const allServers = await db.query.servers.findMany();

  let totalImported = 0;
  let successCount = 0;

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    agentUrl = agentUrl.replace(/\/$/, "");

    try {
      const response = await fetch(`${agentUrl}/export`, {
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
      if (!response.ok) throw new Error(`Agent returned ${response.status}`);

      const data = (await response.json()) as {
        clients: Array<{ id: string; password: string }>;
      };

      const configNamesLower = new Set(data.clients.map((c) => c.id.toLowerCase()));
      const existingDbClients = await db.query.clients.findMany({
        where: eq(clients.serverId, server.id),
      });

      // Upsert: in config → update or insert, set enabled=true
      for (const client of data.clients) {
        const existing = existingDbClients.find(
          (c) => c.name.toLowerCase() === client.id.toLowerCase()
        );
        if (existing) {
          await db
            .update(clients)
            .set({ password: client.password, enabled: true })
            .where(eq(clients.id, existing.id));
        } else {
          await db.insert(clients).values({
            id: crypto.randomUUID(),
            userId: user.sub,
            serverId: server.id,
            name: client.id,
            password: client.password,
            uploadLimit: 0,
            downloadLimit: 0,
            totalLimit: 0,
          });
          totalImported++;
        }
      }

      // In DB but not in config → set enabled=false (client remains in panel, marked disabled)
      for (const dbClient of existingDbClients) {
        if (!configNamesLower.has(dbClient.name.toLowerCase())) {
          await db
            .update(clients)
            .set({ enabled: false })
            .where(eq(clients.id, dbClient.id));
        }
      }

      await db.update(servers).set({ status: "online" }).where(eq(servers.id, server.id));
      successCount++;
    } catch (error) {
      console.error(`Failed to sync server ${server.name}:`, error);
      await db.update(servers).set({ status: "error" }).where(eq(servers.id, server.id));
    }
  }

  return c.json<ApiResponse>({
    success: true,
    data: { servers: successCount, clients: totalImported },
    message: `Synced ${successCount}/${allServers.length} servers, imported ${totalImported} clients`,
  });
});

// System stats from each agent (GET /system) — CPU, RAM, swap, disk per server
serversRoutes.get("/system-stats", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();
  const result: Array<{
    serverId: string;
    serverName: string;
    status: string;
    error?: string;
    cpuPercent?: number;
    ram?: { usedBytes: number; totalBytes: number; usedPercent: number };
    swap?: { usedBytes: number; totalBytes: number; usedPercent: number };
    disk?: { usedBytes: number; totalBytes: number; usedPercent: number };
  }> = [];

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    agentUrl = agentUrl.replace(/\/$/, "");

    try {
      const res = await fetch(`${agentUrl}/system`, {
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
      if (!res.ok) {
        result.push({
          serverId: server.id,
          serverName: server.name,
          status: server.status ?? "unknown",
          error: `Agent returned ${res.status}`,
        });
        continue;
      }
      const data = (await res.json()) as {
        cpuPercent: number;
        ram: { usedBytes: number; totalBytes: number; usedPercent: number };
        swap: { usedBytes: number; totalBytes: number; usedPercent: number };
        disk: { usedBytes: number; totalBytes: number; usedPercent: number };
      };
      result.push({
        serverId: server.id,
        serverName: server.name,
        status: server.status ?? "unknown",
        cpuPercent: data.cpuPercent,
        ram: data.ram,
        swap: data.swap,
        disk: data.disk,
      });
    } catch (err) {
      result.push({
        serverId: server.id,
        serverName: server.name,
        status: server.status ?? "unknown",
        error: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  return c.json<ApiResponse>({
    success: true,
    data: result,
  });
});

serversRoutes.get("/", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();

  return c.json<ApiResponse>({
    success: true,
    data: allServers,
  });
});

serversRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  return c.json<ApiResponse>({
    success: true,
    data: server,
  });
});

serversRoutes.post("/", zValidator("json", createServerSchema), async (c) => {
  const data = c.req.valid("json");
  const db = await getDb();

  const id = crypto.randomUUID();
  const agentToken = crypto.randomUUID();

  await db.insert(servers).values({
    id,
    name: data.name,
    host: data.host,
    agentUrl: data.agentUrl,
    agentToken,
  });

  return c.json<ApiResponse>(
    {
      success: true,
      data: { id, agentToken },
      message: "Server created",
    },
    201
  );
});

serversRoutes.patch("/:id", zValidator("json", updateServerSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  await db.update(servers).set(data).where(eq(servers.id, id));

  return c.json<ApiResponse>({
    success: true,
    message: "Server updated",
  });
});

serversRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const result = await db.delete(servers).where(eq(servers.id, id));

  if (result[0].affectedRows === 0) {
    throw new ApiError(404, "Server not found");
  }

  return c.json<ApiResponse>({
    success: true,
    message: "Server deleted",
  });
});
