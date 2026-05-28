import { config as loadEnv } from "dotenv";
import { createDb } from "../src/db/client.js";
import type { BotAccount, SourceType } from "../src/db/schema.js";
import { QueueService } from "../src/services/queue-service.js";

loadEnv();

function requireCommunityId(
  name: string,
  value: number | undefined,
): number {
  if (!value || Number.isNaN(value)) {
    throw new Error(
      `Missing ${name}. Set it in .env or run: pnpm lemmy:resolve-communities`,
    );
  }
  return value;
}

async function main() {
  const db = createDb(process.env.DATABASE_URL ?? "file:./data/bot-queue.db");
  const queue = new QueueService(db);

  const aiCommunityId = requireCommunityId(
    "AI_TOOL_NEWS_COMMUNITY_ID",
    Number(process.env.AI_TOOL_NEWS_COMMUNITY_ID),
  );
  const githubCommunityId = requireCommunityId(
    "GITHUB_PROJECTS_BOT_COMMUNITY_ID",
    Number(process.env.GITHUB_PROJECTS_BOT_COMMUNITY_ID),
  );

  const samples: Array<{
    title: string;
    url: string;
    body: string;
    botAccount: BotAccount;
    targetCommunity: string;
    targetCommunityId: number;
    sourceType: SourceType;
  }> = [
    {
      title: "[Seed] New Cursor release adds agent routing",
      url: "https://example.com/cursor-agent-routing",
      body: "Short summary for manual review before posting to AI Coding Tool Updates.",
      botAccount: "ai_tool_news_bot",
      targetCommunity:
        process.env.AI_TOOL_NEWS_COMMUNITY_NAME ?? "AI Coding Tool Updates",
      targetCommunityId: aiCommunityId,
      sourceType: "ai_tool_news",
    },
    {
      title: "[Seed] awesome-vibecode-tools",
      url: "https://github.com/example/awesome-vibecode-tools",
      body: "Curated list of vibecoding tools — review before posting to GitHub Projects.",
      botAccount: "github_projects_bot",
      targetCommunity:
        process.env.GITHUB_PROJECTS_BOT_COMMUNITY_NAME ?? "GitHub Projects",
      targetCommunityId: githubCommunityId,
      sourceType: "github_project",
    },
    {
      title: "[Seed] Manual announcement draft",
      url: "",
      body: "Text-only manual queue item for testing body posts.",
      botAccount: "ai_tool_news_bot",
      targetCommunity:
        process.env.AI_TOOL_NEWS_COMMUNITY_NAME ?? "AI Coding Tool Updates",
      targetCommunityId: aiCommunityId,
      sourceType: "manual",
    },
  ];

  for (const item of samples) {
    const created = await queue.insert({
      ...item,
      url: item.url || null,
    });
    console.log(`Inserted ${created.id}: ${created.title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
