package system

import (
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

// Stats holds CPU, RAM, swap and disk usage for the host.
type Stats struct {
	CpuPercent float64   `json:"cpuPercent"`
	Ram        RamStats  `json:"ram"`
	Swap       SwapStats `json:"swap"`
	Disk       DiskStats `json:"disk"`
}

type RamStats struct {
	UsedBytes  uint64  `json:"usedBytes"`
	TotalBytes uint64  `json:"totalBytes"`
	UsedPercent float64 `json:"usedPercent"`
}

type SwapStats struct {
	UsedBytes   uint64  `json:"usedBytes"`
	TotalBytes  uint64  `json:"totalBytes"`
	UsedPercent float64 `json:"usedPercent"`
}

type DiskStats struct {
	UsedBytes   uint64  `json:"usedBytes"`
	TotalBytes  uint64  `json:"totalBytes"`
	UsedPercent float64 `json:"usedPercent"`
}

// Collect returns current system stats. Disk is for path (e.g. "/" or "C:").
func Collect(diskPath string) (*Stats, error) {
	if diskPath == "" {
		diskPath = "/"
	}

	cpuPercents, err := cpu.Percent(0, false)
	if err != nil {
		return nil, err
	}
	cpuPercent := 0.0
	if len(cpuPercents) > 0 {
		cpuPercent = cpuPercents[0]
	}

	vmem, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}
	ram := RamStats{
		UsedBytes:   vmem.Used,
		TotalBytes:  vmem.Total,
		UsedPercent: vmem.UsedPercent,
	}

	swapMem, err := mem.SwapMemory()
	if err != nil {
		return nil, err
	}
	swap := SwapStats{
		UsedBytes:   swapMem.Used,
		TotalBytes:  swapMem.Total,
		UsedPercent: swapMem.UsedPercent,
	}

	du, err := disk.Usage(diskPath)
	if err != nil {
		return nil, err
	}
	diskStats := DiskStats{
		UsedBytes:   du.Used,
		TotalBytes:  du.Total,
		UsedPercent: du.UsedPercent,
	}

	return &Stats{
		CpuPercent: cpuPercent,
		Ram:        ram,
		Swap:       swap,
		Disk:       diskStats,
	}, nil
}
