import { eq } from "drizzle-orm";
import { getDb, clients, servers } from "@hy2-panel/db";

interface ClientConfig {
  id: string;
  password: string;
  enabled: boolean;
}

export async function syncServerClients(serverId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    return { success: false, error: "Server not found" };
  }

  const serverClients = await db.query.clients.findMany({
    where: eq(clients.serverId, serverId),
  });

  const clientConfigs: ClientConfig[] = serverClients.map((c) => ({
    id: c.id,
    password: c.password,
    enabled: c.enabled,
  }));

  try {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }

    const response = await fetch(`${agentUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.agentToken}`,
      },
      body: JSON.stringify({ clients: clientConfigs }),
    });

    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }

    await db.update(servers).set({ status: "online" }).where(eq(servers.id, serverId));

    console.log(`Synced ${clientConfigs.length} clients to server ${server.name}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to sync server ${server.name}:`, message);

    await db.update(servers).set({ status: "error" }).where(eq(servers.id, serverId));

    return { success: false, error: message };
  }
}
