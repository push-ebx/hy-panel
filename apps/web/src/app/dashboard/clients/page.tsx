"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Copy, Check, Eye, EyeOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClients, useServers, useCreateClient, useDeleteClient, useUpdateClient, useTraffic, useClientTrafficHistory } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function ClientsPage() {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const { data: clients, isLoading } = useClients();
  const { data: servers } = useServers();
  const refreshTrafficMs = (useSettingsStore((s) => s.refreshTrafficSec) ?? 30) * 1000;
  const onlineTimeoutSec = useSettingsStore((s) => s.onlineTimeoutSec) ?? 90;
  const onlineTickSec = useSettingsStore((s) => s.onlineTickSec) ?? 10;
  const copyFeedbackSec = useSettingsStore((s) => s.copyFeedbackSec) ?? 2;
  const trafficHistoryHours = useSettingsStore((s) => s.trafficHistoryHours) ?? 24;
  const chartStepMin = useSettingsStore((s) => s.chartStepMin) ?? 5;
  const trafficSnapshotIntervalMin = useSettingsStore((s) => s.trafficSnapshotIntervalMin) ?? 5;

  const { data: trafficData } = useTraffic(refreshTrafficMs, trafficSnapshotIntervalMin);
  const traffic = trafficData?.traffic ?? {};

  // Online = traffic delta > 0 in last fetch (Hysteria /online API unreliable)
  const prevTrafficRef = useRef<Record<string, { tx: number; rx: number }>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!trafficData?.traffic) return;
    const current = trafficData.traffic;
    const prev = prevTrafficRef.current;
    const updates: Record<string, number> = {};
    for (const [clientId, stats] of Object.entries(current)) {
      const p = prev[clientId];
      if (p && (stats.tx > p.tx || stats.rx > p.rx)) {
        updates[clientId] = Date.now();
      }
    }
    if (Object.keys(updates).length > 0) {
      setLastSeen((prev) => ({ ...prev, ...updates }));
    }
    prevTrafficRef.current = { ...current };
  }, [trafficData]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), onlineTickSec * 1000);
    return () => clearInterval(id);
  }, [onlineTickSec]);

  const onlineSet = useMemo(() => {
    const now = Date.now();
    const cutoff = now - onlineTimeoutSec * 1000;
    return new Set(Object.entries(lastSeen).filter(([, t]) => t >= cutoff).map(([id]) => id));
  }, [lastSeen, tick, onlineTimeoutSec]);
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({ serverId: "", name: "", password: "" });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [togglingClientId, setTogglingClientId] = useState<string | null>(null);

  const detailClient = clients?.find((c) => c.id === detailClientId);
  const { data: trafficHistory = [] } = useClientTrafficHistory(detailClientId, trafficHistoryHours);

  const handleCreate = async () => {
    const result = await createClient.mutateAsync({
      serverId: newClient.serverId,
      name: newClient.name,
      password: newClient.password || undefined,
    });
    setCreatedPassword(result.password);
    setNewClient({ serverId: "", name: "", password: "" });
  };

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), copyFeedbackSec * 1000);
  };

  const handleCopyClientPassword = (clientId: string, password: string) => {
    navigator.clipboard.writeText(password);
    setCopiedClientId(clientId);
    setTimeout(() => setCopiedClientId(null), copyFeedbackSec * 1000);
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setCreatedPassword(null);
  };

  const toggleEnabled = (clientId: string, enabled: boolean) => {
    setTogglingClientId(clientId);
    updateClient.mutate(
      { id: clientId, data: { enabled: !enabled } },
      {
        onSettled: () => setTogglingClientId(null),
        onError: (err) => {
          alert(err instanceof Error ? err.message : "Failed to update client");
        },
      }
    );
  };

  const toggleShowPassword = (clientId: string) => {
    setShowPasswords((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const getServerName = (serverId: string) => {
    return servers?.find((s) => s.id === serverId)?.name ?? "Unknown";
  };

  // Group clients by server (order: servers list, then Unknown)
  const clientsByServer = useMemo(() => {
    if (!clients?.length) return [];
    const byId: Record<string, typeof clients> = {};
    for (const c of clients) {
      if (!byId[c.serverId]) byId[c.serverId] = [];
      byId[c.serverId].push(c);
    }
    const serverIds = [...new Set(clients.map((c) => c.serverId))];
    const order = servers?.length
      ? [...servers.map((s) => s.id), ...serverIds.filter((id) => !servers.find((s) => s.id === id))]
      : serverIds;
    const seen = new Set<string>();
    const result: { serverId: string; name: string; clients: typeof clients }[] = [];
    for (const id of order) {
      if (seen.has(id)) continue;
      seen.add(id);
      const list = byId[id];
      if (list?.length) result.push({ serverId: id, name: getServerName(id), clients: list });
    }
    return result;
  }, [clients, servers]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDownloadConfig = async (clientId: string, clientName: string) => {
    const blob = await api.getBlob(`/api/clients/${clientId}/export?format=clash`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clash-${clientName}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Downsample to one point per chartStepMin (X axis step)
  const chartData = (() => {
    if (trafficHistory.length === 0) return [];
    const stepMs = chartStepMin * 60 * 1000;
    const buckets: Array<{ tx: number; rx: number; sampledAt: string }> = [];
    for (const s of trafficHistory) {
      const t = new Date(s.sampledAt).getTime();
      const bucketStart = Math.floor(t / stepMs) * stepMs;
      const last = buckets[buckets.length - 1];
      const lastStart = last ? Math.floor(new Date(last.sampledAt).getTime() / stepMs) * stepMs : null;
      if (lastStart === null || bucketStart > lastStart) {
        buckets.push({ ...s });
      } else {
        buckets[buckets.length - 1] = { ...s };
      }
    }
    return buckets.map((s) => ({
      time: new Date(s.sampledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      tx: s.tx,
      rx: s.rx,
      total: s.tx + s.rx,
    }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addClient")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            {createdPassword ? (
              <>
                <DialogHeader>
                  <DialogTitle>Client Created</DialogTitle>
                  <DialogDescription>
                    Save the password. It won&apos;t be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="flex gap-2">
                      <Input value={createdPassword} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={() => handleCopyPassword(createdPassword)}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseCreate}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{t("addClient")}</DialogTitle>
                  <DialogDescription>
                    Create a new client for a server.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="serverId">Server</Label>
                    <select
                      id="serverId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newClient.serverId}
                      onChange={(e) => setNewClient({ ...newClient, serverId: e.target.value })}
                    >
                      <option value="">Select server...</option>
                      {servers?.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="user1"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (optional)</Label>
                    <Input
                      id="password"
                      placeholder="Leave empty to generate"
                      value={newClient.password}
                      onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={createClient.isPending || !newClient.serverId || !newClient.name}
                  >
                    {createClient.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!detailClientId} onOpenChange={(open) => !open && setDetailClientId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailClient?.name ?? "Client"} — Traffic</DialogTitle>
            <DialogDescription>
              {detailClient && getServerName(detailClient.serverId)} · Last {trafficHistoryHours} h · Step {chartStepMin} min
            </DialogDescription>
          </DialogHeader>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noTrafficDataYet", { min: trafficSnapshotIntervalMin })}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip formatter={(v: number) => formatBytes(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="tx" name="Upload" stroke="hsl(var(--primary))" dot={false} />
                  <Line type="monotone" dataKey="rx" name="Download" stroke="#22c55e" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("allClients")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "…" : clients?.length === 0 ? t("noClients") : (clients.length === 1 ? t("clientsCount", { count: 1 }) : t("clientsCountPlural", { count: clients.length })) + (clientsByServer.length > 0 ? ` · ${clientsByServer.length === 1 ? t("serversCount", { count: 1 }) : t("serversCountPlural", { count: clientsByServer.length })}` : "")}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{tCommon("loading")}</p>
          ) : clients?.length === 0 ? (
            <p className="text-muted-foreground">{t("noClientsHint")}</p>
          ) : (
            <div className="space-y-6">
              {clientsByServer.map(({ serverId, name, clients: groupClients }) => (
                <div key={serverId}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <span>{name}</span>
                    <span className="font-normal">({groupClients.length})</span>
                  </h3>
                  <div className="overflow-x-auto -mx-1">
                    <Table className="table-fixed min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Name</TableHead>
                          <TableHead className="w-[80px] pl-6">Online</TableHead>
                          <TableHead className="w-[120px]">Total</TableHead>
                          <TableHead className="w-[200px]">↑ Tx / ↓ Rx</TableHead>
                          <TableHead className="w-[140px]">Password</TableHead>
                          <TableHead className="w-[90px] text-center">Status</TableHead>
                          <TableHead className="w-[100px] text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupClients.map((client) => (
                          <TableRow
                            key={client.id}
                            className="cursor-pointer"
                            onClick={() => setDetailClientId(client.id)}
                          >
                            <TableCell className="font-medium truncate align-middle">{client.name}</TableCell>
                            <TableCell className="align-middle">
                              {onlineSet.has(client.id) ? (
                                <Badge variant="success" className="font-normal">Online</Badge>
                              ) : (
                                <Badge variant="secondary" className="font-normal">Offline</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap align-middle tabular-nums">
                              {traffic[client.id] ? formatBytes(traffic[client.id].tx + traffic[client.id].rx) : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap align-middle tabular-nums">
                              {traffic[client.id] ? (
                                <span title={`↑ ${traffic[client.id].tx} B / ↓ ${traffic[client.id].rx} B`}>
                                  ↑ {formatBytes(traffic[client.id].tx)} / ↓ {formatBytes(traffic[client.id].rx)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="align-middle">
                              <div className="flex items-center gap-1 min-w-0 w-[120px]">
                                <code className="text-sm truncate block w-[72px]" title={showPasswords[client.id] ? client.password : undefined}>
                                  {showPasswords[client.id] ? client.password : "••••••••"}
                                </code>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleShowPassword(client.id)}>
                                  {showPasswords[client.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyClientPassword(client.id, client.password);
                                  }}
                                >
                                  {copiedClientId === client.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="align-middle">
                              <div className="flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEnabled(client.id, client.enabled);
                                  }}
                                  disabled={togglingClientId === client.id}
                                >
                                  {client.enabled ? (
                                    <Badge variant="success">Enabled</Badge>
                                  ) : (
                                    <Badge variant="secondary">Disabled</Badge>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="align-middle">
                              <div className="flex items-center gap-1 justify-center">
                                <Button variant="ghost" size="icon" onClick={() => handleDownloadConfig(client.id, client.name)} title="Download Clash config">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteClient.mutate(client.id)} disabled={deleteClient.isPending} title="Delete">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
