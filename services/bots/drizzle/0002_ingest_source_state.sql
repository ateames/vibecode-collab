CREATE TABLE `ingest_source_state` (
	`source_key` text PRIMARY KEY NOT NULL,
	`readme_sha` text,
	`known_links_json` text NOT NULL,
	`updated_at` text NOT NULL
);
