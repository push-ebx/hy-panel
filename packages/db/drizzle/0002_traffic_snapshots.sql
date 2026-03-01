CREATE TABLE IF NOT EXISTS `traffic_snapshots` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`tx` bigint NOT NULL DEFAULT 0,
	`rx` bigint NOT NULL DEFAULT 0,
	`sampled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traffic_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `traffic_snapshots_client_id_idx` ON `traffic_snapshots` (`client_id`);
--> statement-breakpoint
CREATE INDEX `traffic_snapshots_sampled_at_idx` ON `traffic_snapshots` (`sampled_at`);
--> statement-breakpoint
ALTER TABLE `traffic_snapshots` ADD CONSTRAINT `traffic_snapshots_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;
