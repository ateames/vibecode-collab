CREATE TABLE `queued_bot_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`body` text,
	`bot_account` text NOT NULL,
	`target_community` text NOT NULL,
	`target_community_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lemmy_post_id` integer,
	`lemmy_post_url` text,
	`lemmy_response_json` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`posted_at` text,
	`ignored_at` text
);
--> statement-breakpoint
CREATE INDEX `queued_bot_posts_status_created_idx` ON `queued_bot_posts` (`status`,`created_at`);
