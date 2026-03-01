"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Users, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStats, useSyncServers, useTraffic } from "@/lib/hooks";

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
  const { data: trafficData } = useTraffic(30000);

  const totalTraffic = Object.values(trafficData?.traffic ?? {}).reduce(
    (acc, { tx, rx }) => ({ tx: acc.tx + tx, rx: acc.rx + rx }),
    { tx: 0, rx: 0 }
  );
  const totalBytes = totalTraffic.tx + totalTraffic.rx;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button
          variant="outline"
          onClick={() => syncServers.mutate()}
          disabled={syncServers.isPending}
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Not tracked</p>
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
    </div>
  );
}
