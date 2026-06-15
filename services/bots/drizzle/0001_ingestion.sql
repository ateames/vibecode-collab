ALTER TABLE `queued_bot_posts` ADD `source_external_id` text;
--> statement-breakpoint
ALTER TABLE `queued_bot_posts` ADD `source_url` text;
--> statement-breakpoint
ALTER TABLE `queued_bot_posts` ADD `ingested_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `queued_bot_posts_source_dedup_idx` ON `queued_bot_posts` (`source_type`,`source_external_id`) WHERE `source_external_id` IS NOT NULL;
