import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, clients, servers } from "@hy2-panel/db";
import { authMiddleware, type JwtPayload } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";

const createClientSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().min(1).max(255),
  password: z.string().optional(),
  uploadLimit: z.number().int().min(0).optional(),
  downloadLimit: z.number().int().min(0).optional(),
  totalLimit: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  password: z.string().optional(),
  uploadLimit: z.number().int().min(0).optional(),
  downloadLimit: z.number().int().min(0).optional(),
  totalLimit: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const clientsRoutes = new Hono();

clientsRoutes.use("*", authMiddleware);

clientsRoutes.get("/", async (c) => {
  const db = await getDb();
  const allClients = await db.query.clients.findMany();

  return c.json<ApiResponse>({
    success: true,
    data: allClients,
  });
});

clientsRoutes.post("/", zValidator("json", createClientSchema), async (c) => {
  const user = c.get("user") as JwtPayload;
  const data = c.req.valid("json");
  const db = await getDb();

  const id = crypto.randomUUID();
  const password = data.password || crypto.randomUUID().replace(/-/g, "");

  await db.insert(clients).values({
    id,
    userId: user.sub,
    serverId: data.serverId,
    name: data.name,
    password,
    uploadLimit: data.uploadLimit || 0,
    downloadLimit: data.downloadLimit || 0,
    totalLimit: data.totalLimit || 0,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
  });

  // Push client to Hysteria2 config on the server's agent
  let agentMessage: string | undefined;
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, data.serverId),
  });
  if (server) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, "")}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${server.agentToken}`,
        },
        body: JSON.stringify({ id: data.name, password }),
      });
      if (!res.ok) {
        agentMessage = `Client saved in panel but could not add to server config (${res.status}).`;
      }
    } catch (err) {
      agentMessage = "Client saved in panel but could not reach agent to update server config.";
    }
  }

  return c.json<ApiResponse>(
    {
      success: true,
      data: { id, password },
      message: agentMessage || "Client created",
    },
    201
  );
});

clientsRoutes.patch("/:id", zValidator("json", updateClientSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = await getDb();

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
  });

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  await db
    .update(clients)
    .set({
      ...data,
      expiresAt: data.expiresAt === null ? null : data.expiresAt ? new Date(data.expiresAt) : undefined,
    })
    .where(eq(clients.id, id));

  return c.json<ApiResponse>({
    success: true,
    message: "Client updated",
  });
});

clientsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = await getDb();

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
  });

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  await db.delete(clients).where(eq(clients.id, id));

  return c.json<ApiResponse>({
    success: true,
    message: "Client deleted",
  });
});
