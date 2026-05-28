import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { BOT_ACCOUNTS } from "./db/schema.js";

loadEnv();

const botAccountSchema = z.enum(BOT_ACCOUNTS);

const optionalPositiveInt = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
}, z.number().int().positive().optional());

const envSchema = z.object({
  PORT: z.coerce.number().default(3030),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().default("file:./data/bot-queue.db"),
  ADMIN_API_TOKEN: z.string().min(16),
  LEMMY_BASE_URL: z.string().url(),
  AI_TOOL_NEWS_BOT_USERNAME: z.string().min(1),
  AI_TOOL_NEWS_BOT_PASSWORD: z.string().min(1),
  AI_TOOL_NEWS_COMMUNITY_ID: optionalPositiveInt,
  AI_TOOL_NEWS_COMMUNITY_NAME: z.string().default("tools_and_workflows"),
  GITHUB_PROJECTS_BOT_USERNAME: z.string().min(1),
  GITHUB_PROJECTS_BOT_PASSWORD: z.string().min(1),
  GITHUB_PROJECTS_BOT_COMMUNITY_ID: optionalPositiveInt,
  GITHUB_PROJECTS_BOT_COMMUNITY_NAME: z.string().default("github_projects"),
});

export type Env = z.infer<typeof envSchema>;

export type BotCredentials = {
  username: string;
  password: string;
  defaultCommunityId: number | undefined;
  communityName: string;
};

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${message}`);
  }
  return result.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }
  return cachedEnv;
}

export function getBotCredentials(botAccount: string): BotCredentials {
  const env = getEnv();
  const parsed = botAccountSchema.safeParse(botAccount);
  if (!parsed.success) {
    throw new Error(`Unknown bot account: ${botAccount}`);
  }

  switch (parsed.data) {
    case "ai_tool_news_bot":
      return {
        username: env.AI_TOOL_NEWS_BOT_USERNAME,
        password: env.AI_TOOL_NEWS_BOT_PASSWORD,
        defaultCommunityId: env.AI_TOOL_NEWS_COMMUNITY_ID,
        communityName: env.AI_TOOL_NEWS_COMMUNITY_NAME,
      };
    case "github_projects_bot":
      return {
        username: env.GITHUB_PROJECTS_BOT_USERNAME,
        password: env.GITHUB_PROJECTS_BOT_PASSWORD,
        defaultCommunityId: env.GITHUB_PROJECTS_BOT_COMMUNITY_ID,
        communityName: env.GITHUB_PROJECTS_BOT_COMMUNITY_NAME,
      };
  }
}

export function getLemmyBaseUrl(): string {
  return getEnv().LEMMY_BASE_URL.replace(/\/$/, "");
}
