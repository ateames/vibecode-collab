import {
  buildGitHubHeaders,
  type GitHubSearchRepo,
} from "./github-api.js";
import type { Env } from "../config.js";
import type { IngestCandidate } from "./types.js";

export type { GitHubSearchRepo };

export type GitHubSearchResponse = {
  items: GitHubSearchRepo[];
};

export type GitHubSearchConfig = Pick<
  Env,
  | "GITHUB_TOKEN"
  | "GITHUB_SEARCH_QUERY"
  | "GITHUB_SEARCH_QUERIES"
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

export type RepoToCandidateOptions = {
  listName?: string;
  linkLabel?: string;
  discoveryNote?: string;
  postUrl?: string;
  sourceExternalId?: string;
};

export function repoToCandidate(
  repo: GitHubSearchRepo,
  targetCommunity: string,
  targetCommunityId: number,
  options: RepoToCandidateOptions = {},
): IngestCandidate {
  const description = repo.description?.trim() ?? "";
  const topics =
    repo.topics && repo.topics.length > 0
      ? `\nTopics: ${repo.topics.join(", ")}`
      : "";
  const discoveryLine =
    options.discoveryNote ??
    (options.listName
      ? `\nDiscovered via ${options.listName} awesome list.`
      : "\nDiscovered via GitHub search.");
  const bodyParts = [
    options.linkLabel ? options.linkLabel : null,
    description ? truncate(description, DESCRIPTION_MAX) : null,
    `⭐ ${repo.stargazers_count.toLocaleString()} stars`,
    repo.language ? `Language: ${repo.language}` : null,
    topics || null,
    discoveryLine.trim(),
  ].filter(Boolean);

  const titleBase = repo.full_name;
  const titleSuffix =
    options.linkLabel?.trim() || description.trim();
  const title =
    titleSuffix.length > 0
      ? `${titleBase} — ${truncate(titleSuffix, 80)}`
      : titleBase;

  return {
    title: truncate(title, 200),
    url: options.postUrl ?? repo.html_url,
    body: bodyParts.join("\n"),
    botAccount: "github_projects_bot",
    targetCommunity,
    targetCommunityId,
    sourceType: "github_project",
    sourceExternalId:
      options.sourceExternalId ?? buildGitHubRepoExternalId(repo.full_name),
    sourceUrl: options.postUrl ?? repo.html_url,
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

export function buildGitHubTreeExternalId(
  fullName: string,
  treePath: string,
): string {
  return `github:tree:${fullName}:${treePath}`;
}

export async function fetchGitHubSearchRepos(
  config: GitHubSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubSearchRepo[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    sort: config.GITHUB_SEARCH_SORT,
    order: "desc",
    per_page: String(config.GITHUB_SEARCH_PER_PAGE),
  });

  const headers = buildGitHubHeaders(config.GITHUB_TOKEN);

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

export function resolveGitHubSearchQueries(config: {
  GITHUB_SEARCH_QUERIES: string[];
  GITHUB_SEARCH_QUERY: string;
}): string[] {
  if (config.GITHUB_SEARCH_QUERIES.length > 0) {
    return config.GITHUB_SEARCH_QUERIES;
  }
  const legacy = config.GITHUB_SEARCH_QUERY.trim();
  return legacy ? [legacy] : [];
}

export async function fetchAllGitHubSearchRepos(
  config: GitHubSearchConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubSearchRepo[]> {
  const queries = resolveGitHubSearchQueries(config);
  const byName = new Map<string, GitHubSearchRepo>();

  for (const query of queries) {
    const repos = await fetchGitHubSearchRepos(config, query, fetchImpl);
    for (const repo of repos) {
      byName.set(repo.full_name, repo);
    }
  }

  return [...byName.values()];
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
  const repos = await fetchAllGitHubSearchRepos(config, fetchImpl);
  return mapGitHubReposToCandidates(
    repos,
    targetCommunity,
    targetCommunityId,
    config.GITHUB_MAX_AGE_DAYS,
  );
}
