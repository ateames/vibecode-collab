import { describe, expect, it, vi } from "vitest";
import { linkToCandidate } from "./github-awesome-lists.js";
import type { ParsedReadmeLink } from "./parse-readme-links.js";

const baseRepo = {
  full_name: "openclaw/openclaw",
  html_url: "https://github.com/openclaw/openclaw",
  description: "Personal AI assistant",
  stargazers_count: 5000,
  language: "TypeScript",
  archived: false,
  pushed_at: new Date().toISOString(),
  topics: ["ai"],
};

describe("github-awesome-lists", () => {
  it("linkToCandidate includes awesome list provenance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(baseRepo), { status: 200 }),
    );

    const link: ParsedReadmeLink = {
      url: "https://github.com/openclaw/openclaw",
      label: "OpenClaw",
      fullName: "openclaw/openclaw",
      treePath: null,
      isMonorepoPath: false,
    };

    const candidate = await linkToCandidate(
      link,
      "kyrolabs/awesome-agents",
      "github_projects",
      8,
      {
        GITHUB_TOKEN: "test",
        GITHUB_AWESOME_LIST_REPOS: [],
        GITHUB_AWESOME_MAX_NEW_PER_LIST: 10,
        GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS: true,
        GITHUB_MAX_AGE_DAYS: 90,
        PAGE_FETCH_TIMEOUT_MS: 10_000,
        PAGE_FETCH_MAX_BYTES: 500_000,
      },
      fetchMock,
    );

    expect(candidate?.body).toContain("awesome-agents awesome list");
    expect(candidate?.title).toContain("OpenClaw");
  });

  it("uses tree external id for monorepo subpaths", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...baseRepo,
          full_name: "Shubhamsaboo/awesome-llm-apps",
          html_url: "https://github.com/Shubhamsaboo/awesome-llm-apps",
        }),
        { status: 200 },
      ),
    );

    const link: ParsedReadmeLink = {
      url: "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_travel_agent",
      label: "AI Travel Agent",
      fullName: "Shubhamsaboo/awesome-llm-apps",
      treePath: "starter_ai_agents/ai_travel_agent",
      isMonorepoPath: true,
    };

    const candidate = await linkToCandidate(
      link,
      "Shubhamsaboo/awesome-llm-apps",
      "github_projects",
      8,
      {
        GITHUB_TOKEN: "test",
        GITHUB_AWESOME_LIST_REPOS: [],
        GITHUB_AWESOME_MAX_NEW_PER_LIST: 10,
        GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS: true,
        GITHUB_MAX_AGE_DAYS: 90,
        PAGE_FETCH_TIMEOUT_MS: 10_000,
        PAGE_FETCH_MAX_BYTES: 500_000,
      },
      fetchMock,
    );

    expect(candidate?.sourceExternalId).toBe(
      "github:tree:Shubhamsaboo/awesome-llm-apps:starter_ai_agents/ai_travel_agent",
    );
    expect(candidate?.url).toBe(link.url);
  });

  it("uses canonical repo html_url for external awesome-list links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...baseRepo,
          full_name: "SWE-agent/SWE-agent",
          html_url: "https://github.com/SWE-agent/SWE-agent",
        }),
        { status: 200 },
      ),
    );

    const link: ParsedReadmeLink = {
      url: "https://github.com/princeton-nlp/SWE-agent",
      label: "SWE-Agent",
      fullName: "princeton-nlp/SWE-agent",
      treePath: null,
      isMonorepoPath: false,
    };

    const candidate = await linkToCandidate(
      link,
      "caramaschiHG/awesome-ai-agents-2026",
      "github_projects",
      8,
      {
        GITHUB_TOKEN: "test",
        GITHUB_AWESOME_LIST_REPOS: [],
        GITHUB_AWESOME_MAX_NEW_PER_LIST: 10,
        GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS: true,
        GITHUB_MAX_AGE_DAYS: 90,
        PAGE_FETCH_TIMEOUT_MS: 10_000,
        PAGE_FETCH_MAX_BYTES: 500_000,
      },
      fetchMock,
    );

    expect(candidate?.url).toBe("https://github.com/SWE-agent/SWE-agent");
    expect(candidate?.sourceExternalId).toBe("github:repo:SWE-agent/SWE-agent");
  });
});
