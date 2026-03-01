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

// GET /online — aggregate online client IDs from all servers' agents (Hysteria2 Traffic Stats API)
clientsRoutes.get("/online", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();
  const allClients = await db.query.clients.findMany();
  const onlineIds = new Set<string>();

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, "")}/online`, {
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, number>;
      for (const name of Object.keys(data)) {
        const client = allClients.find((cl) => cl.serverId === server.id && cl.name === name);
        if (client) onlineIds.add(client.id);
      }
    } catch {
      // skip server on error
    }
  }

  return c.json<ApiResponse>({
    success: true,
    data: { online: [...onlineIds] },
  });
});

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

// Generate Clash/Mihomo config for a client (format like Oleg.yaml)
function buildClashConfig(serverHost: string, clientName: string, clientPassword: string): string {
  const [host, portStr] = serverHost.includes(":") ? serverHost.split(":") : [serverHost, "443"];
  const port = parseInt(portStr, 10) || 443;
  const password = `${clientName}:${clientPassword}`;
  const proxyName = `⚡️ Hysteria2`;

  return `mixed-port: 7890
allow-lan: true
tcp-concurrent: true
enable-process: true
find-process-mode: always
mode: rule
log-level: info
ipv6: false
keep-alive-interval: 30
unified-delay: false

profile:
  store-selected: true
  store-fake-ip: true

sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  sniff:
    HTTP:
      ports:
        - 80
        - 8080-8880
      override-destination: true
    TLS:
      ports:
        - 443
        - 8443

tun:
  enable: true
  stack: mixed
  auto-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53
  strict-route: true
  mtu: 1500

dns:
  enable: true
  prefer-h3: true
  use-hosts: true
  use-system-hosts: true
  listen: 127.0.0.1:6868
  ipv6: false
  enhanced-mode: redir-host
  default-nameserver:
    - tls://77.88.8.8
    - 195.208.4.1
  proxy-server-nameserver:
    - tls://77.88.8.8
    - 195.208.4.1
  direct-nameserver:
    - tls://77.88.8.8
    - 195.208.4.1
  nameserver:
    - https://cloudflare-dns.com/dns-query

proxies:
  - name: ${proxyName}
    type: hysteria2
    server: ${host}
    port: ${port}
    password: "${password}"
    sni: ${host}
    skip-cert-verify: false
    up: 80
    down: 80

proxy-groups:
  - name: 🌍 VPN
    icon: https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hijacking.png
    type: select
    proxies:
      - ${proxyName}

rule-providers:
  ru-inline-banned:
    type: http
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/inline/ru-inline-banned.yaml
    interval: 86400
    behavior: classical
    format: yaml
    path: ./rule-sets/ru-inline-banned.yaml

  ru-inline:
    type: http
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/inline/ru-inline.yaml
    interval: 86400
    behavior: classical
    format: yaml
    path: ./rule-sets/ru-inline.yaml

  ru-app-list:
    type: http
    behavior: classical
    format: yaml
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/ru-app-list.yaml
    path: ./rule-sets/ru-app-list.yaml
    interval: 86400

  torrent-trackers:
    type: http
    behavior: domain
    format: mrs
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/torrent-trackers.mrs
    path: ./rule-sets/torrent-trackers.mrs
    interval: 86400

  torrent-clients:
    type: http
    behavior: classical
    format: yaml
    url: https://github.com/legiz-ru/mihomo-rule-sets/raw/main/other/torrent-clients.yaml
    path: ./rule-sets/torrent-clients.yaml
    interval: 86400

  geosite-ru:
    type: http
    behavior: domain
    format: mrs
    url: https://github.com/MetaCubeX/meta-rules-dat/raw/meta/geo/geosite/category-ru.mrs
    path: ./geosite-ru.mrs
    interval: 86400

  geoip-ru:
    type: http
    behavior: ipcidr
    format: mrs
    url: https://github.com/MetaCubeX/meta-rules-dat/raw/meta/geo/geoip/ru.mrs
    path: ./geoip-ru.mrs
    interval: 86400

rules:
  - RULE-SET,ru-inline-banned,🌍 VPN
  - RULE-SET,ru-app-list,DIRECT
  - RULE-SET,torrent-clients,DIRECT
  - RULE-SET,torrent-trackers,DIRECT
  - RULE-SET,ru-inline,DIRECT
  - RULE-SET,geosite-ru,DIRECT
  - RULE-SET,geoip-ru,DIRECT
  - MATCH,🌍 VPN
`;
}

clientsRoutes.get("/:id/export", async (c) => {
  const id = c.req.param("id");
  const format = c.req.query("format") || "clash";
  const db = await getDb();

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
  });

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, client.serverId),
  });

  if (!server) {
    throw new ApiError(404, "Server not found");
  }

  if (format !== "clash") {
    throw new ApiError(400, "Unsupported format. Use format=clash");
  }

  const yaml = buildClashConfig(server.host, client.name, client.password);
  const filename = `clash-${client.name}.yaml`;

  return new Response(yaml, {
    status: 200,
    headers: {
      "Content-Type": "application/x-yaml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
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

  // Remove client from Hysteria2 config on the server's agent
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, client.serverId),
  });
  if (server) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    try {
      await fetch(`${agentUrl.replace(/\/$/, "")}/clients/${encodeURIComponent(client.name)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
    } catch {
      // best effort: client already removed from panel
    }
  }

  return c.json<ApiResponse>({
    success: true,
    message: "Client deleted",
  });
});
