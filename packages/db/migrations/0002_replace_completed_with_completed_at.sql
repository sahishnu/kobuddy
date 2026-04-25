ALTER TABLE `book` DROP COLUMN `completed`;--> statement-breakpoint
ALTER TABLE `book` ADD `completed_at` integer;
