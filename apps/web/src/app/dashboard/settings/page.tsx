"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import { useSettingsStore } from "@/store/settings";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const { user } = useAuthStore();
  const refreshTrafficSec = useSettingsStore((s) => s.refreshTrafficSec);
  const onlineTimeoutSec = useSettingsStore((s) => s.onlineTimeoutSec);
  const onlineTickSec = useSettingsStore((s) => s.onlineTickSec);
  const trafficHistoryHours = useSettingsStore((s) => s.trafficHistoryHours);
  const chartStepMin = useSettingsStore((s) => s.chartStepMin);
  const liveTrafficIntervalSec = useSettingsStore((s) => s.liveTrafficIntervalSec);
  const trafficSnapshotIntervalMin = useSettingsStore((s) => s.trafficSnapshotIntervalMin);
  const setRefreshTrafficSec = useSettingsStore((s) => s.setRefreshTrafficSec);
  const setOnlineTimeoutSec = useSettingsStore((s) => s.setOnlineTimeoutSec);
  const setOnlineTickSec = useSettingsStore((s) => s.setOnlineTickSec);
  const setTrafficHistoryHours = useSettingsStore((s) => s.setTrafficHistoryHours);
  const setChartStepMin = useSettingsStore((s) => s.setChartStepMin);
  const setLiveTrafficIntervalSec = useSettingsStore((s) => s.setLiveTrafficIntervalSec);
  const setTrafficSnapshotIntervalMin = useSettingsStore((s) => s.setTrafficSnapshotIntervalMin);

  const num = (v: string) => parseInt(v, 10) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("timings")}</CardTitle>
          <CardDescription>{t("timingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refreshTraffic">{t("trafficRefresh")}</Label>
            <Input
              id="refreshTraffic"
              type="number"
              min={5}
              max={600}
              value={refreshTrafficSec}
              onChange={(e) => setRefreshTrafficSec(num(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">{t("trafficRefreshHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onlineTimeout">{t("onlineTimeout")}</Label>
            <Input
              id="onlineTimeout"
              type="number"
              min={30}
              max={600}
              value={onlineTimeoutSec}
              onChange={(e) => setOnlineTimeoutSec(num(e.target.value) || 90)}
            />
            <p className="text-xs text-muted-foreground">{t("onlineTimeoutHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onlineTick">{t("onlineTick")}</Label>
            <Input
              id="onlineTick"
              type="number"
              min={5}
              max={120}
              value={onlineTickSec}
              onChange={(e) => setOnlineTickSec(num(e.target.value) || 10)}
            />
            <p className="text-xs text-muted-foreground">{t("onlineTickHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="liveTrafficInterval">{t("liveTrafficInterval")}</Label>
            <Input
              id="liveTrafficInterval"
              type="number"
              min={1}
              max={60}
              value={liveTrafficIntervalSec}
              onChange={(e) => setLiveTrafficIntervalSec(num(e.target.value) || 2)}
            />
            <p className="text-xs text-muted-foreground">{t("liveTrafficIntervalHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficSnapshotInterval">{t("trafficSnapshotInterval")}</Label>
            <Input
              id="trafficSnapshotInterval"
              type="number"
              min={1}
              max={60}
              value={trafficSnapshotIntervalMin}
              onChange={(e) => setTrafficSnapshotIntervalMin(num(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground">{t("trafficSnapshotIntervalHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficHistory">{t("trafficHistory")}</Label>
            <Input
              id="trafficHistory"
              type="number"
              min={1}
              max={168}
              value={trafficHistoryHours}
              onChange={(e) => setTrafficHistoryHours(num(e.target.value) || 24)}
            />
            <p className="text-xs text-muted-foreground">{t("trafficHistoryHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chartStep">{t("chartStep")}</Label>
            <Input
              id="chartStep"
              type="number"
              min={1}
              max={60}
              value={chartStepMin}
              onChange={(e) => setChartStepMin(num(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground">{t("chartStepHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
          <CardDescription>{t("languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocaleSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account")}</CardTitle>
          <CardDescription>{t("accountDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{tAuth("email")}</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>{tAuth("username")}</Label>
            <Input value={user?.username ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("api")}</CardTitle>
          <CardDescription>{t("apiDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("apiUrl")}</Label>
            <Input value={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dangerZone")}</CardTitle>
          <CardDescription>{t("dangerZoneDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            {t("deleteAccount")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
