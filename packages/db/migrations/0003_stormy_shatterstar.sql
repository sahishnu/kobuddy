CREATE TABLE `stats_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`computed_at` integer NOT NULL
);
