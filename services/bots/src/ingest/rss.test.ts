import { describe, expect, it } from "vitest";
import {
  buildRssExternalId,
  feedItemToCandidate,
  isItemWithinMaxAge,
} from "./rss.js";

describe("rss ingest", () => {
  it("builds stable external ids for the same link", () => {
    const id1 = buildRssExternalId(
      "https://openai.com/blog/rss.xml",
      "https://openai.com/blog/post-1",
    );
    const id2 = buildRssExternalId(
      "https://openai.com/blog/rss.xml",
      "https://openai.com/blog/post-1",
    );
    expect(id1).toBe(id2);
    expect(id1.startsWith("rss:openai.com:")).toBe(true);
  });

  it("maps feed item to candidate", () => {
    const candidate = feedItemToCandidate(
      "https://example.com/feed.xml",
      "Example Blog",
      {
        title: "New AI Tool",
        link: "https://example.com/new-ai-tool",
        pubDate: "Mon, 26 May 2026 12:00:00 GMT",
        contentSnippet: "A short summary.",
      },
      "tools_and_workflows",
      10,
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.botAccount).toBe("ai_tool_news_bot");
    expect(candidate?.sourceType).toBe("ai_tool_news");
    expect(candidate?.body).toContain("Example Blog");
    expect(candidate?.body).toContain("A short summary.");
  });

  it("returns null when item has no link or guid", () => {
    const candidate = feedItemToCandidate(
      "https://example.com/feed.xml",
      "Example",
      { title: "No link" },
      "tools_and_workflows",
      10,
    );
    expect(candidate).toBeNull();
  });

  it("filters items older than max age", () => {
    const now = new Date("2026-05-28T00:00:00Z");
    expect(
      isItemWithinMaxAge(
        { isoDate: "2026-05-20T00:00:00Z" },
        14,
        now,
      ),
    ).toBe(true);
    expect(
      isItemWithinMaxAge(
        { isoDate: "2025-01-01T00:00:00Z" },
        14,
        now,
      ),
    ).toBe(false);
  });

  it("fetchRssCandidates parses feeds via injectable parser", async () => {
    const { fetchRssCandidates } = await import("./rss.js");
    const { candidates, errors } = await fetchRssCandidates(
      {
        AI_NEWS_RSS_URLS: ["https://example.com/feed.xml"],
        AI_NEWS_MAX_ITEMS_PER_FEED: 5,
        AI_NEWS_MAX_AGE_DAYS: 14,
      },
      "tools_and_workflows",
      10,
      async () => ({
        title: "Test Feed",
        items: [
          {
            title: "Item 1",
            link: "https://example.com/1",
            isoDate: "2026-05-27T00:00:00Z",
          },
        ],
      }),
    );

    expect(errors).toHaveLength(0);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toBe("Item 1");
  });
});
