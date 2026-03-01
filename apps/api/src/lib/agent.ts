import { eq } from "drizzle-orm";
import { getDb, clients, servers } from "@hy2-panel/db";

interface ClientConfig {
  id: string;
  password: string;
  enabled: boolean;
}

export async function syncServerClients(serverId: string): Promise<void> {
  const db = await getDb();

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    console.error(`Server not found: ${serverId}`);
    return;
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
    const response = await fetch(`${server.agentUrl}/sync`, {
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

    // Update server status to online
    await db.update(servers).set({ status: "online" }).where(eq(servers.id, serverId));

    console.log(`Synced ${clientConfigs.length} clients to server ${server.name}`);
  } catch (error) {
    console.error(`Failed to sync server ${server.name}:`, error);

    // Update server status to error
    await db.update(servers).set({ status: "error" }).where(eq(servers.id, serverId));
  }
}
