"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, RefreshCw, Cpu, HardDrive, MemoryStick, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useSyncServers, useTraffic, useOnlineClients, useServerSystemStats, useLiveStreams, useLiveTrafficHistory } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function progressBarColor(percent: number) {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-primary";
}

function MetricBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{p.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBarColor(p)}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const stats = useDashboardStats();
  const syncServers = useSyncServers();
  const refreshTrafficMs = (useSettingsStore((s) => s.refreshTrafficSec) ?? 30) * 1000;
  const trafficSnapshotIntervalMin = useSettingsStore((s) => s.trafficSnapshotIntervalMin) ?? 5;
  const { data: trafficData } = useTraffic(refreshTrafficMs, trafficSnapshotIntervalMin);
  const onlineTickMs = (useSettingsStore((s) => s.onlineTickSec) ?? 10) * 1000;
  const { data: onlineData } = useOnlineClients(onlineTickMs);
  const onlineCount = onlineData?.online?.length ?? 0;

  const totalTraffic = Object.values(trafficData?.traffic ?? {}).reduce(
    (acc, { tx, rx }) => ({ tx: acc.tx + tx, rx: acc.rx + rx }),
    { tx: 0, rx: 0 }
  );
  const totalBytes = totalTraffic.tx + totalTraffic.rx;

  const refreshSystemMs = (useSettingsStore((s) => s.refreshTrafficSec) ?? 30) * 1000;
  const { data: systemStats = [] } = useServerSystemStats(refreshSystemMs);

  // Live traffic from /clients/streams (persisted to DB, last 24h)
  const liveIntervalSec = useSettingsStore((s) => s.liveTrafficIntervalSec) ?? 2;
  const liveIntervalMs = liveIntervalSec * 1000;
  const { data: liveData } = useLiveStreams(liveIntervalMs);
  const { data: dbHistory = [] } = useLiveTrafficHistory();
  const [liveHistory, setLiveHistory] = useState<Array<{ time: string; up: number; down: number }>>([]);
  const livePrevRef = useRef<{ tx: number; rx: number; ts: number } | null>(null);
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});
  const [streamUserFilter, setStreamUserFilter] = useState("");
  const [streamSortBy, setStreamSortBy] = useState<"auth" | "destination" | "tx" | "rx" | "started">("tx");
  const [streamSortDir, setStreamSortDir] = useState<"asc" | "desc">("desc");

  const toggleStreamSort = (col: "auth" | "destination" | "tx" | "rx" | "started") => {
    setStreamSortBy(col);
    setStreamSortDir((d) => (streamSortBy === col ? (d === "asc" ? "desc" : "asc") : "desc"));
  };

  const sortStreams = (streams: typeof liveData.streams) => {
    const mult = streamSortDir === "asc" ? 1 : -1;
    return [...streams].sort((a, b) => {
      let cmp = 0;
      switch (streamSortBy) {
        case "auth":
          cmp = (a.clientName ?? "").localeCompare(b.clientName ?? "");
          break;
        case "destination":
          cmp = (a.reqAddr ?? "").localeCompare(b.reqAddr ?? "");
          break;
        case "tx":
          cmp = (a.tx ?? 0) - (b.tx ?? 0);
          break;
        case "rx":
          cmp = (a.rx ?? 0) - (b.rx ?? 0);
          break;
        case "started":
          cmp = new Date(a.initialAt ?? 0).getTime() - new Date(b.initialAt ?? 0).getTime();
          break;
      }
      return mult * cmp;
    });
  };

  const dbHistoryMapped = dbHistory.map((p) => ({ time: p.time, up: p.up, down: p.down })).slice(-60);
  const chartData = liveHistory.length > 0 ? liveHistory : dbHistoryMapped;

  useEffect(() => {
    if (dbHistory.length > 0 && liveHistory.length === 0) {
      setLiveHistory(dbHistory.map((p) => ({ time: p.time, up: p.up, down: p.down })).slice(-60));
    }
  }, [dbHistory, liveHistory.length]);

  useEffect(() => {
    if (!liveData?.streams) return;
    const totalTx = liveData.streams.reduce((sum, s) => sum + (s.tx ?? 0), 0);
    const totalRx = liveData.streams.reduce((sum, s) => sum + (s.rx ?? 0), 0);
    const now = Date.now();

    if (livePrevRef.current) {
      const dt = (now - livePrevRef.current.ts) / 1000;
      if (dt > 0) {
        const upBytesPerSec = Math.max(0, (totalTx - livePrevRef.current.tx) / dt);
        const downBytesPerSec = Math.max(0, (totalRx - livePrevRef.current.rx) / dt);
        const point = {
          time: new Date().toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          up: upBytesPerSec / 1024, // KB/s
          down: downBytesPerSec / 1024,
        };
        setLiveHistory((prev) => {
          const next = [...prev, point];
          return next.slice(-60);
        });
      }
    }

    livePrevRef.current = { tx: totalTx, rx: totalRx, ts: now };
  }, [liveData]);

  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <Button
          variant="outline"
          onClick={() => syncServers.mutate()}
          disabled={syncServers.isPending}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncServers.isPending ? "animate-spin" : ""}`} />
          {t("syncServers")}
        </Button>
      </div>

      {syncServers.isSuccess && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-green-500">
              {t("synced", { servers: syncServers.data.servers, clients: syncServers.data.clients })}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalServers")}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.serversCount}</div>
            <p className="text-xs text-muted-foreground">{stats.serversOnline} {t("serversOnline")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalClients")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientsCount}</div>
            <p className="text-xs text-muted-foreground">{stats.clientsEnabled} {t("clientsEnabled")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("connections")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineCount}</div>
            <p className="text-xs text-muted-foreground">
              {onlineCount === 1 ? t("connectionsOnline", { count: 1 }) : t("connectionsOnlinePlural", { count: onlineCount })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("traffic")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBytes > 0 ? formatBytes(totalBytes) : "—"}</div>
            <p className="text-xs text-muted-foreground">
              {totalBytes > 0 ? `↑ ${formatBytes(totalTraffic.tx)} / ↓ ${formatBytes(totalTraffic.rx)}` : t("trafficFromApi")}
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("liveTraffic")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" KB/s" />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} KB/s`, ""]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="up" name="Upload" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.8} />
                  <Line type="monotone" dataKey="down" name="Download" stroke="#22c55e" dot={false} strokeWidth={1.8} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {liveData?.streams && liveData.streams.length > 0 && (() => {
        const filterLower = streamUserFilter.trim().toLowerCase();
        const byServer = new Map<string, typeof liveData.streams>();
        for (const s of liveData.streams) {
          const key = s.serverId;
          if (!byServer.has(key)) byServer.set(key, []);
          byServer.get(key)!.push(s);
        }
        const servers = Array.from(byServer.entries()).map(([id, list]) => {
          const filtered = filterLower
            ? list.filter((s) => (s.clientName ?? "").toLowerCase().includes(filterLower))
            : list;
          return { serverId: id, serverName: list[0]?.serverName ?? id, streams: list, filteredStreams: filtered };
        });
        const toggleServer = (id: string) => {
          setExpandedServers((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
        };
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-lg font-semibold">{t("streamsByServer")}</h2>
              <Input
                placeholder={t("filterByUser")}
                value={streamUserFilter}
                onChange={(e) => setStreamUserFilter(e.target.value)}
                className="max-w-[200px] h-8 text-sm"
              />
            </div>
            {servers.map(({ serverId, serverName, streams: serverStreams, filteredStreams }) => {
              const isExpanded = expandedServers[serverId] ?? true;
              return (
                <Card key={serverId}>
                  <CardHeader
                    className="pb-2 cursor-pointer select-none hover:bg-muted/50 rounded-t-lg transition-colors"
                    onClick={() => toggleServer(serverId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <CardTitle className="text-base">{serverName}</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {filteredStreams.length} {filteredStreams.length === 1 ? t("stream") : t("streams")}
                        {filterLower && filteredStreams.length !== serverStreams.length && ` ${t("of")} ${serverStreams.length}`}
                      </p>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      {filteredStreams.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          {filterLower ? t("noStreamsMatch") : t("noActiveStreams")}
                        </p>
                      ) : (
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-sm min-w-[500px]">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th
                                  className="pb-2 pr-4 font-medium cursor-pointer hover:text-foreground select-none"
                                  onClick={() => toggleStreamSort("auth")}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {t("auth")}
                                    {streamSortBy === "auth" && (streamSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                  </span>
                                </th>
                                <th
                                  className="pb-2 pr-4 font-medium cursor-pointer hover:text-foreground select-none"
                                  onClick={() => toggleStreamSort("destination")}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {t("destination")}
                                    {streamSortBy === "destination" && (streamSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                  </span>
                                </th>
                                <th
                                  className="pb-2 pr-4 font-medium text-right cursor-pointer hover:text-foreground select-none"
                                  onClick={() => toggleStreamSort("tx")}
                                >
                                  <span className="inline-flex items-center justify-end gap-1">
                                    ↑ Tx
                                    {streamSortBy === "tx" && (streamSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                  </span>
                                </th>
                                <th
                                  className="pb-2 pr-4 font-medium text-right cursor-pointer hover:text-foreground select-none"
                                  onClick={() => toggleStreamSort("rx")}
                                >
                                  <span className="inline-flex items-center justify-end gap-1">
                                    ↓ Rx
                                    {streamSortBy === "rx" && (streamSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                  </span>
                                </th>
                                <th
                                  className="pb-2 font-medium cursor-pointer hover:text-foreground select-none"
                                  onClick={() => toggleStreamSort("started")}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {t("started")}
                                    {streamSortBy === "started" && (streamSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortStreams(filteredStreams).map((s, i) => (
                                <tr key={`${s.serverId}-${s.stream}-${s.reqAddr}-${i}`} className="border-b last:border-0">
                                  <td className="py-2 pr-4 font-medium">{s.clientName ?? "—"}</td>
                                  <td className="py-2 pr-4 font-mono text-xs truncate max-w-[200px]" title={s.reqAddr}>{s.reqAddr}</td>
                                  <td className="py-2 pr-4 text-right tabular-nums">{formatBytes(s.tx)}</td>
                                  <td className="py-2 pr-4 text-right tabular-nums">{formatBytes(s.rx)}</td>
                                  <td className="py-2 text-muted-foreground text-xs">
                                    {s.initialAt ? new Date(s.initialAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" }) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {systemStats.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">{t("serverResources")}</h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {systemStats.map((s) => (
              <Card key={s.serverId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{s.serverName}</CardTitle>
                    <Badge variant={s.status === "online" ? "success" : "secondary"} className="text-xs">
                      {s.status === "online" ? tCommon("statusOnline") : s.status === "error" ? tCommon("statusError") : s.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {s.error ? (
                    <p className="text-muted-foreground">{s.error}</p>
                  ) : (
                    <>
                      {s.cpuPercent != null && (
                        <MetricBar percent={s.cpuPercent} label={t("cpu")} />
                      )}
                      {s.ram && (
                        <div className="space-y-1">
                          <MetricBar percent={s.ram.usedPercent} label={t("ram")} />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(s.ram.usedBytes)} / {formatBytes(s.ram.totalBytes)}
                          </p>
                        </div>
                      )}
                      {s.swap && s.swap.totalBytes > 0 && (
                        <div className="space-y-1">
                          <MetricBar percent={s.swap.usedPercent} label={t("swap")} />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(s.swap.usedBytes)} / {formatBytes(s.swap.totalBytes)}
                          </p>
                        </div>
                      )}
                      {s.disk && (
                        <div className="space-y-1">
                          <MetricBar percent={s.disk.usedPercent} label={t("disk")} />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(s.disk.usedBytes)} / {formatBytes(s.disk.totalBytes)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
