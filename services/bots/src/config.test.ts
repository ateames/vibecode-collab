import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("throws when ADMIN_API_TOKEN is missing", async () => {
    process.env = {
      ADMIN_API_TOKEN: "",
      LEMMY_BASE_URL: "http://localhost:1236",
      AI_TOOL_NEWS_BOT_USERNAME: "ai_tool_news_bot",
      AI_TOOL_NEWS_BOT_PASSWORD: "x",
      GITHUB_PROJECTS_BOT_USERNAME: "github_projects_bot",
      GITHUB_PROJECTS_BOT_PASSWORD: "x",
    };
    const { getEnv } = await import("./config.js");
    expect(() => getEnv()).toThrow(/Invalid environment/);
  });
});
