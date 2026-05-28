import { describe, expect, it, vi } from "vitest";
import {
  buildGitHubRepoExternalId,
  filterGitHubRepo,
  mapGitHubReposToCandidates,
  repoToCandidate,
  type GitHubSearchRepo,
} from "./github-search.js";

const baseRepo: GitHubSearchRepo = {
  full_name: "org/cool-ai-tool",
  html_url: "https://github.com/org/cool-ai-tool",
  description: "An AI coding assistant",
  stargazers_count: 1200,
  language: "TypeScript",
  archived: false,
  pushed_at: new Date().toISOString(),
  topics: ["ai", "llm"],
};

describe("github-search", () => {
  it("builds stable external ids", () => {
    expect(buildGitHubRepoExternalId("org/cool-ai-tool")).toBe(
      "github:repo:org/cool-ai-tool",
    );
  });

  it("maps repo to candidate with body metadata", () => {
    const candidate = repoToCandidate(baseRepo, "github_projects", 42);
    expect(candidate.botAccount).toBe("github_projects_bot");
    expect(candidate.sourceType).toBe("github_project");
    expect(candidate.url).toBe(baseRepo.html_url);
    expect(candidate.body).toContain("1,200");
    expect(candidate.body).toContain("TypeScript");
    expect(candidate.body).toContain("ai, llm");
  });

  it("filters archived and stale repos", () => {
    const now = new Date("2026-05-28T00:00:00Z");
    expect(
      filterGitHubRepo(
        { ...baseRepo, archived: true },
        90,
        now,
      ),
    ).toBe("archived");

    expect(
      filterGitHubRepo(
        {
          ...baseRepo,
          pushed_at: "2024-01-01T00:00:00Z",
        },
        90,
        now,
      ),
    ).toBe("too old");
  });

  it("mapGitHubReposToCandidates applies filters", () => {
    const { candidates, filtered } = mapGitHubReposToCandidates(
      [
        baseRepo,
        { ...baseRepo, full_name: "org/old", archived: true },
      ],
      "github_projects",
      1,
      90,
      new Date("2026-05-28T00:00:00Z"),
    );
    expect(candidates).toHaveLength(1);
    expect(filtered).toBe(1);
  });

  it("fetchGitHubSearchRepos calls API with query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [baseRepo],
        }),
        {
          status: 200,
          headers: { "X-RateLimit-Remaining": "29" },
        },
      ),
    );

    const { fetchGitHubSearchRepos } = await import("./github-search.js");
    const repos = await fetchGitHubSearchRepos(
      {
        GITHUB_TOKEN: "test-token",
        GITHUB_SEARCH_QUERY: "topic:ai",
        GITHUB_SEARCH_SORT: "stars",
        GITHUB_SEARCH_PER_PAGE: 10,
        GITHUB_MAX_AGE_DAYS: 90,
      },
      fetchMock,
    );

    expect(repos).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("search/repositories");
    expect(url).toContain("topic%3Aai");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
  });
});
