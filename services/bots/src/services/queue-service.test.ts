import { beforeEach, describe, expect, it } from "vitest";
import { QueueService } from "./queue-service.js";

describe("QueueService", () => {
  let queue: QueueService;

  beforeEach(async () => {
    const Database = (await import("better-sqlite3")).default;
    const sqlite = new Database(":memory:");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const migrationsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../drizzle",
    );
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      for (const statement of sql
        .split(/--> statement-breakpoint\n?/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        sqlite.exec(statement);
      }
    }
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const schema = await import("../db/schema.js");
    const dbInstance = drizzle(sqlite, { schema });
    queue = new QueueService(dbInstance);
  });

  it("lists only pending and failed items", async () => {
    const item = await queue.insert({
      title: "Test",
      botAccount: "ai_tool_news_bot",
      targetCommunity: "AI Coding Tool Updates",
      targetCommunityId: 1,
      sourceType: "manual",
    });
    await queue.ignore(item.id);
    const pending = await queue.listPending();
    expect(pending.find((p) => p.id === item.id)).toBeUndefined();

    const item2 = await queue.insert({
      title: "Pending",
      botAccount: "github_projects_bot",
      targetCommunity: "GitHub Projects",
      targetCommunityId: 2,
      sourceType: "github_project",
    });
    const list = await queue.listPending();
    expect(list.some((p) => p.id === item2.id)).toBe(true);
  });

  it("marks ignored with ignored_at", async () => {
    const item = await queue.insert({
      title: "Ignore me",
      botAccount: "ai_tool_news_bot",
      targetCommunity: "AI Coding Tool Updates",
      targetCommunityId: 1,
      sourceType: "manual",
    });
    const ignored = await queue.ignore(item.id);
    expect(ignored?.status).toBe("ignored");
    expect(ignored?.ignoredAt).toBeTruthy();
  });

  it("insertIfNew skips duplicates by source_external_id", async () => {
    const input = {
      title: "Repo",
      url: "https://github.com/o/r",
      botAccount: "github_projects_bot" as const,
      targetCommunity: "GitHub Projects",
      targetCommunityId: 2,
      sourceType: "github_project" as const,
      sourceExternalId: "github:repo:o/r",
      sourceUrl: "https://github.com/o/r",
    };
    const first = await queue.insertIfNew(input);
    expect(first.created).toBe(true);
    const second = await queue.insertIfNew({ ...input, title: "Other title" });
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });

  it("claimForPosting only works for pending or failed", async () => {
    const item = await queue.insert({
      title: "Post me",
      botAccount: "ai_tool_news_bot",
      targetCommunity: "AI Coding Tool Updates",
      targetCommunityId: 1,
      sourceType: "manual",
    });
    const claimed = await queue.claimForPosting(item.id);
    expect(claimed?.status).toBe("posting");
    const second = await queue.claimForPosting(item.id);
    expect(second).toBeNull();
  });
});
