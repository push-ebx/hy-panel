"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, RefreshCw, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useSyncServers, useTraffic, useOnlineClients, useServerSystemStats } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
        <div>
          <h2 className="text-lg font-semibold mb-3">Server resources</h2>
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
                <CardContent className="space-y-3 text-sm">
                  {s.error ? (
                    <p className="text-muted-foreground">{s.error}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" /> CPU
                        </span>
                        <span className="tabular-nums font-medium">
                          {s.cpuPercent != null ? `${s.cpuPercent.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      {s.ram && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <MemoryStick className="h-4 w-4" /> RAM
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatBytes(s.ram.usedBytes)} / {formatBytes(s.ram.totalBytes)} ({s.ram.usedPercent.toFixed(0)}%)
                          </span>
                        </div>
                      )}
                      {s.swap && s.swap.totalBytes > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Swap</span>
                          <span className="tabular-nums font-medium">
                            {formatBytes(s.swap.usedBytes)} / {formatBytes(s.swap.totalBytes)} ({s.swap.usedPercent.toFixed(0)}%)
                          </span>
                        </div>
                      )}
                      {s.disk && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <HardDrive className="h-4 w-4" /> Disk
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatBytes(s.disk.usedBytes)} / {formatBytes(s.disk.totalBytes)} ({s.disk.usedPercent.toFixed(0)}%)
                          </span>
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
