"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, RefreshCw, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useSyncServers, useTraffic, useOnlineClients, useServerSystemStats } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
