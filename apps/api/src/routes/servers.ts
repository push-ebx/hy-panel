import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, servers, clients } from "@hy2-panel/db";
import { authMiddleware, type JwtPayload } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";
import { syncServerClients } from "../lib/agent";

const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1),
  agentUrl: z.string().url(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  host: z.string().min(1).optional(),
  agentUrl: z.string().url().optional(),
});

export const serversRoutes = new Hono();

serversRoutes.use("*", authMiddleware);

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

// Sync all servers
serversRoutes.post("/sync", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();

  const results = await Promise.all(
    allServers.map((s) => syncServerClients(s.id))
  );

  const failed = results.filter((r) => !r.success).length;

  return c.json<ApiResponse>({
    success: failed === 0,
    message: `Synced ${allServers.length - failed}/${allServers.length} servers`,
  });
});

// Import clients from server config
serversRoutes.post("/:id/import", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user") as JwtPayload;
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  let agentUrl = server.agentUrl;
  if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
    agentUrl = `http://${agentUrl}`;
  }

  try {
    const response = await fetch(`${agentUrl}/export`, {
      headers: {
        Authorization: `Bearer ${server.agentToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }

    const data = await response.json() as { clients: Array<{ id: string; password: string }> };

    let imported = 0;
    for (const client of data.clients) {
      // Check if client already exists
      const existing = await db.query.clients.findFirst({
        where: eq(clients.password, client.password),
      });

      if (!existing) {
        await db.insert(clients).values({
          id: crypto.randomUUID(),
          userId: user.sub,
          serverId: id,
          name: client.id || `Imported ${imported + 1}`,
          password: client.password,
          uploadLimit: 0,
          downloadLimit: 0,
          totalLimit: 0,
        });
        imported++;
      }
    }

    await db.update(servers).set({ status: "online" }).where(eq(servers.id, id));

    return c.json<ApiResponse>({
      success: true,
      data: { imported, total: data.clients.length },
      message: `Imported ${imported} clients`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db.update(servers).set({ status: "error" }).where(eq(servers.id, id));
    throw new ApiError(502, message);
  }
});

// Sync single server
serversRoutes.post("/:id/sync", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  const result = await syncServerClients(id);

  if (!result.success) {
    throw new ApiError(502, result.error || "Sync failed");
  }

  return c.json<ApiResponse>({
    success: true,
    message: "Sync completed",
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
