"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, RefreshCw, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useSyncServers, useTraffic, useOnlineClients, useServerSystemStats, useLiveStreams } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
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
  const { data: trafficData } = useTraffic(refreshTrafficMs);
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

  // Live traffic from /clients/streams
  const liveIntervalMs = 2000;
  const { data: liveData } = useLiveStreams(liveIntervalMs);
  const [liveHistory, setLiveHistory] = useState<Array<{ time: string; up: number; down: number }>>([]);
  const livePrevRef = useRef<{ tx: number; rx: number; ts: number } | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <Button
          variant="outline"
          onClick={() => syncServers.mutate()}
          disabled={syncServers.isPending}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncServers.isPending ? "animate-spin" : ""}`} />
          Sync Servers
        </Button>
      </div>

      {syncServers.isSuccess && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-green-500">
              Synced {syncServers.data.servers} servers, imported {syncServers.data.clients} clients
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.serversCount}</div>
            <p className="text-xs text-muted-foreground">{stats.serversOnline} online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientsCount}</div>
            <p className="text-xs text-muted-foreground">{stats.clientsEnabled} enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineCount}</div>
            <p className="text-xs text-muted-foreground">
              {onlineCount === 1 ? "1 client online" : `${onlineCount} clients online now`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traffic</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBytes > 0 ? formatBytes(totalBytes) : "—"}</div>
            <p className="text-xs text-muted-foreground">
              {totalBytes > 0 ? `↑ ${formatBytes(totalTraffic.tx)} / ↓ ${formatBytes(totalTraffic.rx)}` : "From Traffic Stats API"}
            </p>
          </CardContent>
        </Card>
      </div>

      {liveHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Live traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveHistory} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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

      {systemStats.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Server resources</h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {systemStats.map((s) => (
              <Card key={s.serverId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{s.serverName}</CardTitle>
                    <Badge variant={s.status === "online" ? "success" : "secondary"} className="text-xs">
                      {s.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {s.error ? (
                    <p className="text-muted-foreground">{s.error}</p>
                  ) : (
                    <>
                      {s.cpuPercent != null && (
                        <MetricBar percent={s.cpuPercent} label="CPU" />
                      )}
                      {s.ram && (
                        <div className="space-y-1">
                          <MetricBar percent={s.ram.usedPercent} label="RAM" />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(s.ram.usedBytes)} / {formatBytes(s.ram.totalBytes)}
                          </p>
                        </div>
                      )}
                      {s.swap && s.swap.totalBytes > 0 && (
                        <div className="space-y-1">
                          <MetricBar percent={s.swap.usedPercent} label="Swap" />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(s.swap.usedBytes)} / {formatBytes(s.swap.totalBytes)}
                          </p>
                        </div>
                      )}
                      {s.disk && (
                        <div className="space-y-1">
                          <MetricBar percent={s.disk.usedPercent} label="Disk" />
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
