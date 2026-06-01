import { describe, expect, it, vi } from "vitest";
import type { SummarizerConfig } from "../config.js";
import type { IngestCandidate } from "../ingest/types.js";
import { enrichCandidateWithSummary } from "./enrich-candidate.js";

const disabledConfig: SummarizerConfig = {
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: "gpt-4o-mini",
  SUMMARIZER_ENABLED: false,
  SUMMARY_MIN_SOURCE_CHARS: 200,
  SUMMARY_MAX_OUTPUT_CHARS: 300,
  PAGE_FETCH_TIMEOUT_MS: 5000,
  PAGE_FETCH_MAX_BYTES: 500_000,
  GITHUB_TOKEN: undefined,
};

const activeConfig: SummarizerConfig = {
  ...disabledConfig,
  OPENAI_API_KEY: "test-key",
  SUMMARIZER_ENABLED: true,
};

const candidate: IngestCandidate = {
  title: "Example post",
  url: "https://example.com/article",
  body: "Source: Feed\n\nOriginal excerpt.",
  botAccount: "ai_tool_news_bot",
  targetCommunity: "tools",
  targetCommunityId: 1,
  sourceType: "ai_tool_news",
  sourceExternalId: "rss:example:abc",
  sourceUrl: "https://example.com/article",
};

describe("enrichCandidateWithSummary", () => {
  it("returns candidate unchanged when summarizer disabled", async () => {
    const result = await enrichCandidateWithSummary(candidate, disabledConfig);
    expect(result).toEqual(candidate);
  });

  it("returns candidate unchanged when extraction yields no content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const emptyCandidate = {
      ...candidate,
      body: "Source: Feed\n\n",
    };
    const result = await enrichCandidateWithSummary(emptyCandidate, activeConfig, {
      fetchImpl,
    });
    expect(result.body).toBe(emptyCandidate.body);
  });

  it("replaces body with AI summary on success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<p>Long enough article content for the model.</p>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Concise AI summary." } }],
          }),
          { status: 200 },
        ),
      );

    const shortBodyCandidate = {
      ...candidate,
      body: "Source: Feed\n\nShort.",
    };

    const result = await enrichCandidateWithSummary(
      shortBodyCandidate,
      activeConfig,
      { fetchImpl },
    );
    expect(result.body).toBe("Concise AI summary.\n\nSource: Feed");
  });

  it("keeps original body when OpenAI fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("x".repeat(250), {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Server error" } }), {
          status: 500,
        }),
      );

    const longBodyCandidate = {
      ...candidate,
      body: `Source: Feed\n\n${"x".repeat(250)}`,
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await enrichCandidateWithSummary(
      longBodyCandidate,
      activeConfig,
      { fetchImpl },
    );
    expect(result.body).toBe(longBodyCandidate.body);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
