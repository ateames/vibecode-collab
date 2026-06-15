import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const BOT_ACCOUNTS = [
  "ai_tool_news_bot",
  "github_projects_bot",
] as const;
export type BotAccount = (typeof BOT_ACCOUNTS)[number];

export const SOURCE_TYPES = [
  "ai_tool_news",
  "github_project",
  "manual",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const QUEUE_STATUSES = [
  "pending",
  "ignored",
  "posting",
  "posted",
  "failed",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const queuedBotPosts = sqliteTable(
  "queued_bot_posts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    url: text("url"),
    body: text("body"),
    botAccount: text("bot_account").notNull(),
    targetCommunity: text("target_community").notNull(),
    targetCommunityId: integer("target_community_id").notNull(),
    sourceType: text("source_type").notNull(),
    status: text("status").notNull().default("pending"),
    lemmyPostId: integer("lemmy_post_id"),
    lemmyPostUrl: text("lemmy_post_url"),
    lemmyResponseJson: text("lemmy_response_json"),
    errorMessage: text("error_message"),
    sourceExternalId: text("source_external_id"),
    sourceUrl: text("source_url"),
    ingestedAt: text("ingested_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    postedAt: text("posted_at"),
    ignoredAt: text("ignored_at"),
  },
  (table) => [
    index("queued_bot_posts_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("queued_bot_posts_source_dedup_idx").on(
      table.sourceType,
      table.sourceExternalId,
    ),
  ],
);

export type QueuedBotPost = typeof queuedBotPosts.$inferSelect;
export type NewQueuedBotPost = typeof queuedBotPosts.$inferInsert;

export const ingestSourceState = sqliteTable("ingest_source_state", {
  sourceKey: text("source_key").primaryKey(),
  readmeSha: text("readme_sha"),
  knownLinksJson: text("known_links_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type IngestSourceState = typeof ingestSourceState.$inferSelect;
