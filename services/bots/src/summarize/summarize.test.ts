import { describe, expect, it, vi } from "vitest";
import type { SummarizerConfig } from "../config.js";
import {
  buildSummarizeUserPrompt,
  summarizeText,
} from "./summarize.js";

const baseConfig: SummarizerConfig = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "gpt-4o-mini",
  SUMMARIZER_ENABLED: true,
  SUMMARY_MIN_SOURCE_CHARS: 200,
  SUMMARY_MAX_OUTPUT_CHARS: 50,
  PAGE_FETCH_TIMEOUT_MS: 5000,
  PAGE_FETCH_MAX_BYTES: 500_000,
  GITHUB_TOKEN: undefined,
};

describe("buildSummarizeUserPrompt", () => {
  it("includes title and content", () => {
    const prompt = buildSummarizeUserPrompt("My title", "Body text");
    expect(prompt).toContain("Title: My title");
    expect(prompt).toContain("Body text");
  });
});

describe("summarizeText", () => {
  it("returns null without API key", async () => {
    const result = await summarizeText("Title", "Content", {
      ...baseConfig,
      OPENAI_API_KEY: undefined,
    });
    expect(result).toBeNull();
  });

  it("returns truncated summary from OpenAI response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "This is a long summary that should be truncated because it exceeds the configured maximum output length.",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await summarizeText(
      "Title",
      "Content",
      baseConfig,
      { fetchImpl },
    );
    expect(result).toHaveLength(50);
    expect(result?.endsWith("…")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("throws on API error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
        status: 429,
      }),
    );
    await expect(
      summarizeText("Title", "Content", baseConfig, { fetchImpl }),
    ).rejects.toThrow(/Rate limited/);
  });
});
