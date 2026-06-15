import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "../db/client.js";
import {
  type BotAccount,
  type NewQueuedBotPost,
  type QueuedBotPost,
  type QueueStatus,
  type SourceType,
  queuedBotPosts,
} from "../db/schema.js";
import { nowIso } from "../lib/time.js";

export type QueueItemInput = {
  title: string;
  url?: string | null;
  body?: string | null;
  botAccount: BotAccount;
  targetCommunity: string;
  targetCommunityId: number;
  sourceType: SourceType;
  sourceExternalId?: string | null;
  sourceUrl?: string | null;
  ingestedAt?: string | null;
};

export type QueueItemDto = {
  id: string;
  title: string;
  url: string | null;
  body: string | null;
  botAccount: string;
  targetCommunity: string;
  targetCommunityId: number;
  sourceType: string;
  status: string;
  lemmyPostId: number | null;
  lemmyPostUrl: string | null;
  errorMessage: string | null;
  sourceExternalId: string | null;
  sourceUrl: string | null;
  ingestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  ignoredAt: string | null;
};

function toDto(row: QueuedBotPost): QueueItemDto {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    body: row.body,
    botAccount: row.botAccount,
    targetCommunity: row.targetCommunity,
    targetCommunityId: row.targetCommunityId,
    sourceType: row.sourceType,
    status: row.status,
    lemmyPostId: row.lemmyPostId,
    lemmyPostUrl: row.lemmyPostUrl,
    errorMessage: row.errorMessage,
    sourceExternalId: row.sourceExternalId,
    sourceUrl: row.sourceUrl,
    ingestedAt: row.ingestedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    postedAt: row.postedAt,
    ignoredAt: row.ignoredAt,
  };
}

export class QueueService {
  constructor(private readonly db: Db) {}

  async listPending(): Promise<QueueItemDto[]> {
    const rows = await this.db
      .select()
      .from(queuedBotPosts)
      .where(inArray(queuedBotPosts.status, ["pending", "failed"]))
      .orderBy(desc(queuedBotPosts.createdAt));
    return rows.map(toDto);
  }

  async getById(id: string): Promise<QueueItemDto | null> {
    const rows = await this.db
      .select()
      .from(queuedBotPosts)
      .where(eq(queuedBotPosts.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toDto(row) : null;
  }

  async findByExternalId(
    sourceType: SourceType,
    sourceExternalId: string,
  ): Promise<QueueItemDto | null> {
    const rows = await this.db
      .select()
      .from(queuedBotPosts)
      .where(
        and(
          eq(queuedBotPosts.sourceType, sourceType),
          eq(queuedBotPosts.sourceExternalId, sourceExternalId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? toDto(row) : null;
  }

  async insert(item: QueueItemInput): Promise<QueueItemDto> {
    const now = nowIso();
    const ingestedAt = item.ingestedAt ?? now;
    const row: NewQueuedBotPost = {
      id: randomUUID(),
      title: item.title,
      url: item.url ?? null,
      body: item.body ?? null,
      botAccount: item.botAccount,
      targetCommunity: item.targetCommunity,
      targetCommunityId: item.targetCommunityId,
      sourceType: item.sourceType,
      sourceExternalId: item.sourceExternalId ?? null,
      sourceUrl: item.sourceUrl ?? null,
      ingestedAt: item.sourceExternalId ? ingestedAt : null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(queuedBotPosts).values(row);
    return toDto(row as QueuedBotPost);
  }

  async insertIfNew(
    item: QueueItemInput & { sourceExternalId: string },
  ): Promise<{ created: boolean; item: QueueItemDto }> {
    const existing = await this.findByExternalId(
      item.sourceType,
      item.sourceExternalId,
    );
    if (existing) {
      return { created: false, item: existing };
    }
    const inserted = await this.insert(item);
    return { created: true, item: inserted };
  }

  async resetStalePosting(): Promise<number> {
    const rows = await this.db
      .select({ id: queuedBotPosts.id })
      .from(queuedBotPosts)
      .where(eq(queuedBotPosts.status, "posting"));
    const message =
      "Posting was interrupted — check Lemmy before retrying";
    for (const row of rows) {
      await this.markFailed(row.id, message);
    }
    return rows.length;
  }

  async ignore(id: string): Promise<QueueItemDto | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    if (existing.status !== "pending" && existing.status !== "failed") {
      throw new Error(
        `Cannot ignore item with status "${existing.status}"`,
      );
    }
    const now = nowIso();
    await this.db
      .update(queuedBotPosts)
      .set({
        status: "ignored",
        ignoredAt: now,
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(queuedBotPosts.id, id));
    return this.getById(id);
  }

  async claimForPosting(id: string): Promise<QueueItemDto | null> {
    const rows = await this.db
      .select()
      .from(queuedBotPosts)
      .where(
        and(
          eq(queuedBotPosts.id, id),
          inArray(queuedBotPosts.status, ["pending", "failed"]),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    const now = nowIso();
    await this.db
      .update(queuedBotPosts)
      .set({ status: "posting", updatedAt: now, errorMessage: null })
      .where(eq(queuedBotPosts.id, id));
    return this.getById(id);
  }

  async markPosted(
    id: string,
    data: {
      lemmyPostId: number;
      lemmyPostUrl: string;
      lemmyResponseJson: string;
    },
  ): Promise<QueueItemDto | null> {
    const now = nowIso();
    await this.db
      .update(queuedBotPosts)
      .set({
        status: "posted",
        lemmyPostId: data.lemmyPostId,
        lemmyPostUrl: data.lemmyPostUrl,
        lemmyResponseJson: data.lemmyResponseJson,
        errorMessage: null,
        postedAt: now,
        updatedAt: now,
      })
      .where(eq(queuedBotPosts.id, id));
    return this.getById(id);
  }

  async markFailed(id: string, errorMessage: string): Promise<QueueItemDto | null> {
    const now = nowIso();
    await this.db
      .update(queuedBotPosts)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: now,
      })
      .where(eq(queuedBotPosts.id, id));
    return this.getById(id);
  }

  async resetPostingToPending(id: string): Promise<void> {
    const now = nowIso();
    await this.db
      .update(queuedBotPosts)
      .set({ status: "pending", updatedAt: now })
      .where(
        and(eq(queuedBotPosts.id, id), eq(queuedBotPosts.status, "posting")),
      );
  }
}

export function isActionableStatus(status: string): status is QueueStatus {
  return status === "pending" || status === "failed";
}
