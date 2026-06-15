import type { Env } from "../config.js";
import type { IngestCandidate } from "./types.js";
import {
  fetchReadmeMarkdown,
  fetchRepo,
  type GitHubApiConfig,
} from "./github-api.js";
import {
  buildGitHubRepoExternalId,
  buildGitHubTreeExternalId,
  filterGitHubRepo,
  repoToCandidate,
} from "./github-search.js";
import {
  diffNewLinks,
  parseReadmeLinks,
  type ParsedReadmeLink,
} from "./parse-readme-links.js";
import type { IngestStateService } from "../services/ingest-state-service.js";

export type AwesomeListsConfig = Pick<
  Env,
  | "GITHUB_TOKEN"
  | "GITHUB_AWESOME_LIST_REPOS"
  | "GITHUB_AWESOME_MAX_NEW_PER_LIST"
  | "GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS"
  | "GITHUB_MAX_AGE_DAYS"
  | "PAGE_FETCH_TIMEOUT_MS"
  | "PAGE_FETCH_MAX_BYTES"
>;

function buildSourceKey(listFullName: string): string {
  return `awesome:${listFullName}`;
}

function toApiConfig(config: AwesomeListsConfig): GitHubApiConfig {
  return {
    GITHUB_TOKEN: config.GITHUB_TOKEN,
    PAGE_FETCH_TIMEOUT_MS: config.PAGE_FETCH_TIMEOUT_MS,
    PAGE_FETCH_MAX_BYTES: config.PAGE_FETCH_MAX_BYTES,
  };
}

export async function linkToCandidate(
  link: ParsedReadmeLink,
  listFullName: string,
  targetCommunity: string,
  targetCommunityId: number,
  config: AwesomeListsConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<IngestCandidate | null> {
  if (!link.fullName) {
    return null;
  }

  const repo = await fetchRepo(link.fullName, toApiConfig(config), fetchImpl);
  if (!repo) {
    return null;
  }

  const filterReason = filterGitHubRepo(repo, config.GITHUB_MAX_AGE_DAYS);
  if (filterReason) {
    return null;
  }

  const listLabel = listFullName.split("/")[1] ?? listFullName;
  const sourceExternalId = link.treePath
    ? buildGitHubTreeExternalId(link.fullName, link.treePath)
    : buildGitHubRepoExternalId(repo.full_name);
  const postUrl = link.treePath ? link.url : repo.html_url;

  return repoToCandidate(repo, targetCommunity, targetCommunityId, {
    listName: listLabel,
    linkLabel: link.label || undefined,
    discoveryNote: `\nDiscovered via ${listLabel} awesome list.`,
    postUrl,
    sourceExternalId,
  });
}

export async function collectAwesomeListCandidates(
  config: AwesomeListsConfig,
  targetCommunity: string,
  targetCommunityId: number,
  ingestState: IngestStateService,
  fetchImpl: typeof fetch = fetch,
): Promise<{ candidates: IngestCandidate[]; errors: string[] }> {
  const candidates: IngestCandidate[] = [];
  const errors: string[] = [];

  if (config.GITHUB_AWESOME_LIST_REPOS.length === 0) {
    return { candidates, errors };
  }

  if (!config.GITHUB_TOKEN?.trim()) {
    errors.push("GITHUB_TOKEN is required for awesome list ingestion");
    return { candidates, errors };
  }

  for (const listFullName of config.GITHUB_AWESOME_LIST_REPOS) {
    try {
      const readme = await fetchReadmeMarkdown(
        listFullName,
        toApiConfig(config),
        fetchImpl,
      );
      if (!readme) {
        errors.push(`${listFullName}: failed to fetch README`);
        continue;
      }

      const listRepo = await fetchRepo(
        listFullName,
        toApiConfig(config),
        fetchImpl,
      );
      const defaultBranch = listRepo?.default_branch ?? "main";

      const allLinks = parseReadmeLinks(readme.content, listFullName, {
        resolveMonorepoPaths: config.GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS,
        defaultBranch,
      });

      const sourceKey = buildSourceKey(listFullName);
      const prior = await ingestState.get(sourceKey);
      const knownUrls = new Set(prior?.knownLinks ?? []);
      const newLinks = diffNewLinks(allLinks, knownUrls);
      const linksToProcess = newLinks.slice(0, config.GITHUB_AWESOME_MAX_NEW_PER_LIST);

      for (const link of linksToProcess) {
        const candidate = await linkToCandidate(
          link,
          listFullName,
          targetCommunity,
          targetCommunityId,
          config,
          fetchImpl,
        );
        if (candidate) {
          candidates.push(candidate);
        }
      }

      await ingestState.save({
        sourceKey,
        readmeSha: readme.sha,
        knownLinks: allLinks.map((link) => link.url),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${listFullName}: ${message}`);
    }
  }

  return { candidates, errors };
}

export function isGitHubIngestConfigured(env: Pick<
  Env,
  "GITHUB_SEARCH_QUERIES" | "GITHUB_SEARCH_QUERY" | "GITHUB_AWESOME_LIST_REPOS"
>): boolean {
  const hasQueries =
    env.GITHUB_SEARCH_QUERIES.length > 0 || env.GITHUB_SEARCH_QUERY.trim().length > 0;
  return hasQueries || env.GITHUB_AWESOME_LIST_REPOS.length > 0;
}
