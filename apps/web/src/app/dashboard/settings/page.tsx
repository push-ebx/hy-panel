"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import { useSettingsStore } from "@/store/settings";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const refreshTrafficSec = useSettingsStore((s) => s.refreshTrafficSec);
  const onlineTimeoutSec = useSettingsStore((s) => s.onlineTimeoutSec);
  const onlineTickSec = useSettingsStore((s) => s.onlineTickSec);
  const trafficHistoryHours = useSettingsStore((s) => s.trafficHistoryHours);
  const chartStepMin = useSettingsStore((s) => s.chartStepMin);
  const setRefreshTrafficSec = useSettingsStore((s) => s.setRefreshTrafficSec);
  const setOnlineTimeoutSec = useSettingsStore((s) => s.setOnlineTimeoutSec);
  const setOnlineTickSec = useSettingsStore((s) => s.setOnlineTickSec);
  const setTrafficHistoryHours = useSettingsStore((s) => s.setTrafficHistoryHours);
  const setChartStepMin = useSettingsStore((s) => s.setChartStepMin);

  const num = (v: string) => parseInt(v, 10) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Timings</CardTitle>
          <CardDescription>Intervals and timeouts used across the panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refreshTraffic">Traffic refresh (sec)</Label>
            <Input
              id="refreshTraffic"
              type="number"
              min={5}
              max={600}
              value={refreshTrafficSec}
              onChange={(e) => setRefreshTrafficSec(num(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">5–600. How often to fetch tx/rx from agents. Traffic column, dashboard, charts.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onlineTimeout">Online timeout (sec)</Label>
            <Input
              id="onlineTimeout"
              type="number"
              min={30}
              max={600}
              value={onlineTimeoutSec}
              onChange={(e) => setOnlineTimeoutSec(num(e.target.value) || 90)}
            />
            <p className="text-xs text-muted-foreground">30–600. After no traffic growth, show client as offline.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onlineTick">Online tick (sec)</Label>
            <Input
              id="onlineTick"
              type="number"
              min={5}
              max={120}
              value={onlineTickSec}
              onChange={(e) => setOnlineTickSec(num(e.target.value) || 10)}
            />
            <p className="text-xs text-muted-foreground">5–120. How often to recalc online list from last-seen.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficHistory">Traffic chart period (hours)</Label>
            <Input
              id="trafficHistory"
              type="number"
              min={1}
              max={168}
              value={trafficHistoryHours}
              onChange={(e) => setTrafficHistoryHours(num(e.target.value) || 24)}
            />
            <p className="text-xs text-muted-foreground">1–168. Time range for the traffic history chart in client detail.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chartStep">Traffic chart X step (min)</Label>
            <Input
              id="chartStep"
              type="number"
              min={1}
              max={60}
              value={chartStepMin}
              onChange={(e) => setChartStepMin(num(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground">1–60. Interval between points on the chart X axis (data is downsampled to this step).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={user?.username ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API</CardTitle>
          <CardDescription>API configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API URL</Label>
            <Input value={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
