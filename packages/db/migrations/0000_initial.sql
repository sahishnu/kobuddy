CREATE TABLE `device` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book` (
	`md5` text PRIMARY KEY NOT NULL,
	`title` text,
	`custom_title` text,
	`authors` text,
	`series` text,
	`language` text,
	`isbn` text,
	`hidden` integer DEFAULT false NOT NULL,
	`cover_path` text,
	`cover_source` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `book_hidden_idx` ON `book` (`hidden`);
--> statement-breakpoint
CREATE TABLE `book_device` (
	`book_md5` text NOT NULL,
	`device_id` text NOT NULL,
	`last_open` integer,
	`pages` integer,
	`notes` integer,
	`highlights` integer,
	`total_read_time` integer DEFAULT 0 NOT NULL,
	`total_read_pages` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`book_md5`, `device_id`),
	FOREIGN KEY (`book_md5`) REFERENCES `book`(`md5`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_stat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_md5` text NOT NULL,
	`device_id` text NOT NULL,
	`page` integer NOT NULL,
	`start_time` integer NOT NULL,
	`duration` integer NOT NULL,
	`total_pages` integer NOT NULL,
	FOREIGN KEY (`book_md5`) REFERENCES `book`(`md5`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_stat_device_book_page_start` ON `page_stat` (`device_id`,`book_md5`,`page`,`start_time`);
--> statement-breakpoint
CREATE INDEX `page_stat_book_idx` ON `page_stat` (`book_md5`);
--> statement-breakpoint
CREATE INDEX `page_stat_start_idx` ON `page_stat` (`start_time`);
