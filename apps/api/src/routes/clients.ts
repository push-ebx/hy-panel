import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, lt, and, gte } from "drizzle-orm";
import { getDb, clients, servers, trafficSnapshots } from "@hy2-panel/db";
import { authMiddleware, type JwtPayload } from "../middleware/auth";
import { ApiError } from "../middleware/error-handler";
import type { ApiResponse } from "@hy2-panel/shared";

const AGENT_FETCH_TIMEOUT_MS = 30_000;

async function fetchAgent(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch with one retry on timeout/network error (for critical disable flow) */
async function fetchAgentWithRetry(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetchAgent(url, init);
  } catch (err) {
    const isRetryable = err instanceof Error && (err.name === "AbortError" || err.name === "TypeError");
    if (isRetryable) {
      await new Promise((r) => setTimeout(r, 2000));
      return fetchAgent(url, init);
    }
    throw err;
  }
}

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
        const client = allClients.find((cl) => cl.serverId === server.id && cl.name.toLowerCase() === name.toLowerCase());
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

// GET /traffic — aggregate traffic from agents and persist totals (survives Hysteria restart)
clientsRoutes.get("/traffic", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();
  const allClients = await db.query.clients.findMany();
  const apiTraffic: Record<string, { tx: number; rx: number }> = {};

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, "")}/traffic`, {
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, { tx: number; rx: number }>;
      for (const [name, stats] of Object.entries(data)) {
        const client = allClients.find((cl) => cl.serverId === server.id && cl.name.toLowerCase() === name.toLowerCase());
        if (client) {
          apiTraffic[client.id] = {
            tx: (apiTraffic[client.id]?.tx ?? 0) + (stats.tx ?? 0),
            rx: (apiTraffic[client.id]?.rx ?? 0) + (stats.rx ?? 0),
          };
        }
      }
    } catch {
      // skip server on error
    }
  }

  // Persist cumulative totals (detect Hysteria reset when api drops) and build response
  const traffic: Record<string, { tx: number; rx: number }> = {};
  const now = new Date();

  for (const client of allClients) {
    const api = apiTraffic[client.id];
    let totalTx = Number(client.totalTx);
    let totalRx = Number(client.totalRx);
    let lastApiTx = Number(client.lastApiTx);
    let lastApiRx = Number(client.lastApiRx);

    if (api) {
      const deltaTx = Math.max(0, api.tx - lastApiTx);
      const deltaRx = Math.max(0, api.rx - lastApiRx);
      totalTx += deltaTx;
      totalRx += deltaRx;
      lastApiTx = api.tx;
      lastApiRx = api.rx;
      await db
        .update(clients)
        .set({ totalTx, totalRx, lastApiTx, lastApiRx })
        .where(eq(clients.id, client.id));
    }

    traffic[client.id] = { tx: totalTx, rx: totalRx };
  }

  // Save snapshots (throttled: at most once per 5 min per client), keep last 7 days
  try {
    const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
    const RETENTION_DAYS = 7;
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    for (const [clientId, stats] of Object.entries(traffic)) {
      const last = await db.query.trafficSnapshots.findFirst({
        where: eq(trafficSnapshots.clientId, clientId),
        orderBy: desc(trafficSnapshots.sampledAt),
      });
      if (!last || now.getTime() - last.sampledAt.getTime() > SNAPSHOT_INTERVAL_MS) {
        await db.insert(trafficSnapshots).values({
          id: crypto.randomUUID(),
          clientId,
          tx: stats.tx,
          rx: stats.rx,
          sampledAt: now,
        });
      }
    }

    await db.delete(trafficSnapshots).where(lt(trafficSnapshots.sampledAt, cutoff));
  } catch {
    // table may not exist yet
  }

  return c.json<ApiResponse>({
    success: true,
    data: { traffic },
  });
});

// GET /streams — live streams from agents' /streams (proxy for Hysteria /dump/streams)
clientsRoutes.get("/streams", async (c) => {
  const db = await getDb();
  const allServers = await db.query.servers.findMany();
  const allClients = await db.query.clients.findMany();

  type UpstreamStream = {
    state: string;
    auth: string;
    connection: number;
    stream: number;
    req_addr: string;
    hooked_req_addr: string;
    tx: number;
    rx: number;
    initial_at: string;
    last_active_at: string;
  };

  const streams: Array<{
    serverId: string;
    serverName: string;
    clientId: string | null;
    clientName: string | null;
    state: string;
    stream: number;
    reqAddr: string;
    tx: number;
    rx: number;
    lastActiveAt: string;
  }> = [];

  for (const server of allServers) {
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, "")}/streams`, {
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { streams?: UpstreamStream[] };
      for (const s of data.streams ?? []) {
        const client = allClients.find(
          (cl) => cl.serverId === server.id && cl.name.toLowerCase() === (s.auth ?? "").toLowerCase()
        );
        streams.push({
          serverId: server.id,
          serverName: server.name,
          clientId: client?.id ?? null,
          clientName: client?.name ?? (s.auth || null),
          state: s.state,
          stream: s.stream,
          reqAddr: s.req_addr,
          tx: s.tx ?? 0,
          rx: s.rx ?? 0,
          lastActiveAt: s.last_active_at,
        });
      }
    } catch {
      // skip server on error
    }
  }

  return c.json<ApiResponse>({
    success: true,
    data: { streams },
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
      const res = await fetchAgent(`${agentUrl.replace(/\/$/, "")}/clients`, {
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

  // When disabling: remove from config first, then update DB (so user is really removed)
  if (data.enabled === false) {
    const server = await db.query.servers.findFirst({
      where: eq(servers.id, client.serverId),
    });
    if (!server) {
      throw new ApiError(400, "Server not found for this client");
    }
    let agentUrl = server.agentUrl;
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      agentUrl = `http://${agentUrl}`;
    }
    agentUrl = agentUrl.replace(/\/$/, "");
    const name = client.name;
    let res: Response;
    try {
      res = await fetchAgentWithRetry(`${agentUrl}/clients/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${server.agentToken}` },
      });
    } catch (err) {
      console.error("Agent request failed (disable):", err);
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Agent did not respond within 30 seconds. Check agent URL and network."
        : "Could not reach agent. Check agent URL and that the agent is running.";
      throw new ApiError(502, msg);
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`Agent DELETE /clients/${name}:`, res.status, body);
      throw new ApiError(502, res.status === 404 ? "Client not found in server config" : `Agent error: ${res.status}`);
    }
  }

  await db
    .update(clients)
    .set({
      ...data,
      expiresAt: data.expiresAt === null ? null : data.expiresAt ? new Date(data.expiresAt) : undefined,
    })
    .where(eq(clients.id, id));

  // When enabling: update DB first, then add to config in background
  if (data.enabled === true) {
    const server = await db.query.servers.findFirst({
      where: eq(servers.id, client.serverId),
    });
    if (server) {
      let agentUrl = server.agentUrl;
      if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
        agentUrl = `http://${agentUrl}`;
      }
      agentUrl = agentUrl.replace(/\/$/, "");
      const updated = await db.query.clients.findFirst({ where: eq(clients.id, id) });
      const name = updated?.name ?? client.name;
      const password = updated?.password ?? client.password;
      const token = server.agentToken;
      void fetchAgentWithRetry(`${agentUrl}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: name, password }),
      }).then((res) => {
        if (!res.ok) console.error(`Agent POST /clients failed for ${name}:`, res.status);
      }).catch((err) => console.error("Agent request failed (enable):", err));
    }
  }

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

clientsRoutes.get("/:id/traffic-history", async (c) => {
  const id = c.req.param("id");
  const period = c.req.query("period") || "24"; // hours
  const db = await getDb();

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
  });
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  const hours = Math.min(168, Math.max(1, parseInt(period, 10) || 24));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const snapshots = await db.query.trafficSnapshots.findMany({
    where: and(eq(trafficSnapshots.clientId, id), gte(trafficSnapshots.sampledAt, since)),
    orderBy: desc(trafficSnapshots.sampledAt),
  });

  const filtered = snapshots.reverse();

  return c.json<ApiResponse>({
    success: true,
    data: filtered.map((s) => ({ tx: s.tx, rx: s.rx, sampledAt: s.sampledAt })),
  });
});

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
      await fetchAgent(`${agentUrl.replace(/\/$/, "")}/clients/${encodeURIComponent(client.name)}`, {
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
