import { describe, expect, it, vi } from "vitest";
import type { SummarizerConfig } from "../config.js";
import type { IngestCandidate } from "../ingest/types.js";
import {
  extractContentForCandidate,
  fetchGitHubReadme,
  fetchPageText,
} from "./extract-content.js";

const baseConfig: SummarizerConfig = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "gpt-4o-mini",
  SUMMARIZER_ENABLED: true,
  SUMMARY_MIN_SOURCE_CHARS: 200,
  SUMMARY_MAX_OUTPUT_CHARS: 300,
  PAGE_FETCH_TIMEOUT_MS: 5000,
  PAGE_FETCH_MAX_BYTES: 500_000,
  GITHUB_TOKEN: "gh-token",
};

function rssCandidate(body: string): IngestCandidate {
  return {
    title: "News item",
    url: "https://example.com/article",
    body,
    botAccount: "ai_tool_news_bot",
    targetCommunity: "tools",
    targetCommunityId: 1,
    sourceType: "ai_tool_news",
    sourceExternalId: "rss:example:abc",
    sourceUrl: "https://example.com/article",
  };
}

describe("extractContentForCandidate", () => {
  it("uses RSS excerpt when long enough", async () => {
    const longExcerpt = "x".repeat(250);
    const candidate = rssCandidate(
      `Source: Example Feed\n\nPublished: 2025-01-01\n\n${longExcerpt}`,
    );
    const content = await extractContentForCandidate(candidate, baseConfig);
    expect(content).toBe(longExcerpt);
  });

  it("fetches page when RSS excerpt is short", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("<html><body><p>Full article text here.</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const candidate = rssCandidate("Source: Feed\n\nShort.");
    const content = await extractContentForCandidate(candidate, baseConfig, {
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/article",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(content).toContain("Full article text");
  });

  it("fetches GitHub README for github_project", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("# My Project\n\nA useful library.", {
        status: 200,
      }),
    );
    const candidate: IngestCandidate = {
      title: "org/repo",
      url: "https://github.com/org/repo",
      body: "Repo description",
      botAccount: "github_projects_bot",
      targetCommunity: "github",
      targetCommunityId: 2,
      sourceType: "github_project",
      sourceExternalId: "github:repo:org/repo",
      sourceUrl: "https://github.com/org/repo",
    };
    const content = await extractContentForCandidate(candidate, baseConfig, {
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/readme",
      expect.any(Object),
    );
    expect(content).toContain("useful library");
  });

  it("skips manual items without URL", async () => {
    const candidate: IngestCandidate = {
      title: "Manual",
      url: "",
      body: "Notes",
      botAccount: "ai_tool_news_bot",
      targetCommunity: "tools",
      targetCommunityId: 1,
      sourceType: "manual",
      sourceExternalId: "manual:1",
      sourceUrl: "",
    };
    const content = await extractContentForCandidate(candidate, baseConfig);
    expect(content).toBeNull();
  });
});

describe("fetchPageText", () => {
  it("returns null for non-HTML content types", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("binary", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    const text = await fetchPageText("https://example.com/file.pdf", baseConfig, fetchImpl);
    expect(text).toBeNull();
  });
});

describe("fetchGitHubReadme", () => {
  it("returns null when API fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Not found", { status: 404 }));
    const text = await fetchGitHubReadme("org/missing", baseConfig, fetchImpl);
    expect(text).toBeNull();
  });
});
