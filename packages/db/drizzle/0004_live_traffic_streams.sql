CREATE TABLE IF NOT EXISTS `live_traffic_snapshots` (
	`id` varchar(36) NOT NULL,
	`up_bytes_per_sec` bigint NOT NULL DEFAULT 0,
	`down_bytes_per_sec` bigint NOT NULL DEFAULT 0,
	`sampled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_traffic_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `live_traffic_snapshots_sampled_at_idx` ON `live_traffic_snapshots` (`sampled_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `live_traffic_state` (
	`id` varchar(36) NOT NULL,
	`last_total_tx` bigint NOT NULL DEFAULT 0,
	`last_total_rx` bigint NOT NULL DEFAULT 0,
	`last_sampled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_traffic_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stream_snapshots` (
	`id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`server_name` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`req_addr` varchar(512) NOT NULL,
	`tx` bigint NOT NULL DEFAULT 0,
	`rx` bigint NOT NULL DEFAULT 0,
	`initial_at` varchar(64),
	`last_active_at` varchar(64),
	`sampled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stream_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `stream_snapshots_sampled_at_idx` ON `stream_snapshots` (`sampled_at`);
--> statement-breakpoint
CREATE INDEX `stream_snapshots_server_id_idx` ON `stream_snapshots` (`server_id`);
