ALTER TABLE `clients` ADD COLUMN `total_tx` bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `total_rx` bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `last_api_tx` bigint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `last_api_rx` bigint NOT NULL DEFAULT 0;
