import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULTS = {
  refreshTrafficSec: 30,
  onlineTimeoutSec: 90,
  onlineTickSec: 10,
  trafficHistoryHours: 24,
  chartStepMin: 5,
  liveTrafficIntervalSec: 2,
  trafficSnapshotIntervalMin: 5,
} as const;

export interface SettingsState {
  refreshTrafficSec: number;
  onlineTimeoutSec: number;
  onlineTickSec: number;
  trafficHistoryHours: number;
  chartStepMin: number;
  liveTrafficIntervalSec: number;
  trafficSnapshotIntervalMin: number;
  setRefreshTrafficSec: (v: number) => void;
  setOnlineTimeoutSec: (v: number) => void;
  setOnlineTickSec: (v: number) => void;
  setTrafficHistoryHours: (v: number) => void;
  setChartStepMin: (v: number) => void;
  setLiveTrafficIntervalSec: (v: number) => void;
  setTrafficSnapshotIntervalMin: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      refreshTrafficSec: DEFAULTS.refreshTrafficSec,
      onlineTimeoutSec: DEFAULTS.onlineTimeoutSec,
      onlineTickSec: DEFAULTS.onlineTickSec,
      trafficHistoryHours: DEFAULTS.trafficHistoryHours,
      chartStepMin: DEFAULTS.chartStepMin,
      liveTrafficIntervalSec: DEFAULTS.liveTrafficIntervalSec,
      trafficSnapshotIntervalMin: DEFAULTS.trafficSnapshotIntervalMin,
      setRefreshTrafficSec: (v) => set({ refreshTrafficSec: Math.max(5, Math.min(600, v)) }),
      setOnlineTimeoutSec: (v) => set({ onlineTimeoutSec: Math.max(30, Math.min(600, v)) }),
      setOnlineTickSec: (v) => set({ onlineTickSec: Math.max(5, Math.min(120, v)) }),
      setTrafficHistoryHours: (v) => set({ trafficHistoryHours: Math.max(1, Math.min(168, v)) }),
      setChartStepMin: (v) => set({ chartStepMin: Math.max(1, Math.min(60, v)) }),
      setLiveTrafficIntervalSec: (v) => set({ liveTrafficIntervalSec: Math.max(1, Math.min(60, v)) }),
      setTrafficSnapshotIntervalMin: (v) => set({ trafficSnapshotIntervalMin: Math.max(1, Math.min(60, v)) }),
    }),
    { name: "hy2-panel-settings" }
  )
);

export function getRefreshTrafficMs() {
  return (useSettingsStore.getState().refreshTrafficSec ?? DEFAULTS.refreshTrafficSec) * 1000;
}
