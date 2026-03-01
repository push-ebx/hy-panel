CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 443,
	`agent_url` varchar(255) NOT NULL,
	`agent_token` varchar(255) NOT NULL,
	`status` enum('online','offline','error') NOT NULL DEFAULT 'offline',
	`config` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `servers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`upload_limit` bigint NOT NULL DEFAULT 0,
	`download_limit` bigint NOT NULL DEFAULT 0,
	`total_limit` bigint NOT NULL DEFAULT 0,
	`expires_at` timestamp,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_stats` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`bytes_in` bigint NOT NULL DEFAULT 0,
	`bytes_out` bigint NOT NULL DEFAULT 0,
	`last_connected_at` timestamp,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `server_stats` (
	`id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`uptime` bigint NOT NULL DEFAULT 0,
	`connections` int NOT NULL DEFAULT 0,
	`bytes_in` bigint NOT NULL DEFAULT 0,
	`bytes_out` bigint NOT NULL DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_stats` ADD CONSTRAINT `client_stats_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_stats` ADD CONSTRAINT `server_stats_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_stats_client_id_idx` ON `client_stats` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_stats_timestamp_idx` ON `client_stats` (`timestamp`);--> statement-breakpoint
CREATE INDEX `server_stats_server_id_idx` ON `server_stats` (`server_id`);--> statement-breakpoint
CREATE INDEX `server_stats_timestamp_idx` ON `server_stats` (`timestamp`);