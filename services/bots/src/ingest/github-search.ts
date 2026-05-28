import type { Env } from "../config.js";
import type { IngestCandidate } from "./types.js";

export type GitHubSearchRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  archived: boolean;
  pushed_at: string;
  topics?: string[];
};

export type GitHubSearchResponse = {
  items: GitHubSearchRepo[];
};

export type GitHubSearchConfig = Pick<
  Env,
  | "GITHUB_TOKEN"
  | "GITHUB_SEARCH_QUERY"
  | "GITHUB_SEARCH_SORT"
  | "GITHUB_SEARCH_PER_PAGE"
  | "GITHUB_MAX_AGE_DAYS"
>;

const DESCRIPTION_MAX = 400;

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function buildGitHubRepoExternalId(fullName: string): string {
  return `github:repo:${fullName}`;
}

export function repoToCandidate(
  repo: GitHubSearchRepo,
  targetCommunity: string,
  targetCommunityId: number,
): IngestCandidate {
  const description = repo.description?.trim() ?? "";
  const topics =
    repo.topics && repo.topics.length > 0
      ? `\nTopics: ${repo.topics.join(", ")}`
      : "";
  const bodyParts = [
    description ? truncate(description, DESCRIPTION_MAX) : null,
    `⭐ ${repo.stargazers_count.toLocaleString()} stars`,
    repo.language ? `Language: ${repo.language}` : null,
    topics || null,
    "\nDiscovered via GitHub search.",
  ].filter(Boolean);

  const titleBase = repo.full_name;
  const title =
    description.length > 0
      ? `${titleBase} — ${truncate(description, 80)}`
      : titleBase;

  return {
    title: truncate(title, 200),
    url: repo.html_url,
    body: bodyParts.join("\n"),
    botAccount: "github_projects_bot",
    targetCommunity,
    targetCommunityId,
    sourceType: "github_project",
    sourceExternalId: buildGitHubRepoExternalId(repo.full_name),
    sourceUrl: repo.html_url,
  };
}

export function filterGitHubRepo(
  repo: GitHubSearchRepo,
  maxAgeDays: number,
  now: Date = new Date(),
): string | null {
  if (repo.archived) {
    return "archived";
  }
  const pushedAt = new Date(repo.pushed_at);
  if (Number.isNaN(pushedAt.getTime())) {
    return "invalid pushed_at";
  }
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  if (now.getTime() - pushedAt.getTime() > maxAgeMs) {
    return "too old";
  }
  return null;
}

export async function fetchGitHubSearchRepos(
  config: GitHubSearchConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubSearchRepo[]> {
  const query = config.GITHUB_SEARCH_QUERY.trim();
  if (!query) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    sort: config.GITHUB_SEARCH_SORT,
    order: "desc",
    per_page: String(config.GITHUB_SEARCH_PER_PAGE),
  });

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vibecode-collab-bots",
  };
  if (config.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${config.GITHUB_TOKEN}`;
  }

  const response = await fetchImpl(
    `https://api.github.com/search/repositories?${params}`,
    { headers },
  );

  const remaining = response.headers.get("X-RateLimit-Remaining");
  if (remaining !== null) {
    console.log(`GitHub API rate limit remaining: ${remaining}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GitHub search failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as GitHubSearchResponse;
  return data.items ?? [];
}

export function mapGitHubReposToCandidates(
  repos: GitHubSearchRepo[],
  targetCommunity: string,
  targetCommunityId: number,
  maxAgeDays: number,
  now: Date = new Date(),
): { candidates: IngestCandidate[]; filtered: number } {
  let filtered = 0;
  const candidates: IngestCandidate[] = [];

  for (const repo of repos) {
    const reason = filterGitHubRepo(repo, maxAgeDays, now);
    if (reason) {
      filtered += 1;
      continue;
    }
    candidates.push(repoToCandidate(repo, targetCommunity, targetCommunityId));
  }

  return { candidates, filtered };
}

export async function collectGitHubCandidates(
  config: GitHubSearchConfig,
  targetCommunity: string,
  targetCommunityId: number,
  fetchImpl?: typeof fetch,
): Promise<{ candidates: IngestCandidate[]; filtered: number }> {
  const repos = await fetchGitHubSearchRepos(config, fetchImpl);
  return mapGitHubReposToCandidates(
    repos,
    targetCommunity,
    targetCommunityId,
    config.GITHUB_MAX_AGE_DAYS,
  );
}
