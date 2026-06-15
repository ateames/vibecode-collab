import {
  getEnv,
  getIngestCommunityConfig,
  getSummarizerConfig,
  type IngestSource,
} from "../config.js";
import type { Db } from "../db/client.js";
import type { QueueService } from "../services/queue-service.js";
import { IngestStateService } from "../services/ingest-state-service.js";
import {
  collectAwesomeListCandidates,
  isGitHubIngestConfigured,
} from "./github-awesome-lists.js";
import { collectGitHubCandidates, resolveGitHubSearchQueries } from "./github-search.js";
import { fetchRssCandidates } from "./rss.js";
import type {
  IngestCandidate,
  IngestRunResult,
  IngestSourceResult,
} from "./types.js";
import { enrichCandidateWithSummary } from "../summarize/enrich-candidate.js";

async function enqueueCandidates(
  queue: QueueService,
  candidates: IngestCandidate[],
): Promise<IngestSourceResult> {
  let inserted = 0;
  let skipped = 0;
  const summarizerConfig = getSummarizerConfig();

  for (const candidate of candidates) {
    const enriched = await enrichCandidateWithSummary(candidate, summarizerConfig);
    const result = await queue.insertIfNew(enriched);
    if (result.created) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  return { inserted, skipped, errors: [] };
}

function mergeResults(
  target: IngestSourceResult,
  source: IngestSourceResult,
): IngestSourceResult {
  return {
    inserted: target.inserted + source.inserted,
    skipped: target.skipped + source.skipped,
    errors: [...target.errors, ...source.errors],
  };
}

export async function runIngest(
  queue: QueueService,
  sources: IngestSource[],
  db: Db,
): Promise<IngestRunResult> {
  const env = getEnv();
  const communities = getIngestCommunityConfig();
  const ingestState = new IngestStateService(db);

  const result: IngestRunResult = {
    github: { inserted: 0, skipped: 0, errors: [] },
    rss: { inserted: 0, skipped: 0, errors: [] },
  };

  if (sources.includes("github")) {
    if (!isGitHubIngestConfigured(env)) {
      result.github.errors.push(
        "GitHub ingest is not configured (set GITHUB_SEARCH_QUERIES and/or GITHUB_AWESOME_LIST_REPOS)",
      );
    } else {
      const searchQueries = resolveGitHubSearchQueries(env);
      if (searchQueries.length > 0) {
        try {
          const { candidates } = await collectGitHubCandidates(
            env,
            communities.githubProjectsCommunityName,
            communities.githubProjectsCommunityId,
          );
          const searchResult = await enqueueCandidates(queue, candidates);
          result.github = mergeResults(result.github, searchResult);
          result.github.details = {
            ...result.github.details,
            search: searchResult,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.github.errors.push(message);
          result.github.details = {
            ...result.github.details,
            search: { inserted: 0, skipped: 0, errors: [message] },
          };
        }
      }

      if (env.GITHUB_AWESOME_LIST_REPOS.length > 0) {
        try {
          const { candidates, errors } = await collectAwesomeListCandidates(
            env,
            communities.githubProjectsCommunityName,
            communities.githubProjectsCommunityId,
            ingestState,
          );
          const awesomeEnqueue = await enqueueCandidates(queue, candidates);
          const awesomeResult = { ...awesomeEnqueue, errors };
          result.github = mergeResults(result.github, awesomeResult);
          result.github.details = {
            ...result.github.details,
            awesomeLists: awesomeResult,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.github.errors.push(message);
          result.github.details = {
            ...result.github.details,
            awesomeLists: { inserted: 0, skipped: 0, errors: [message] },
          };
        }
      }
    }
  }

  if (sources.includes("rss")) {
    if (env.AI_NEWS_RSS_URLS.length === 0) {
      result.rss.errors.push("AI_NEWS_RSS_URLS is not configured");
    } else {
      const { candidates, errors } = await fetchRssCandidates(
        env,
        communities.aiToolNewsCommunityName,
        communities.aiToolNewsCommunityId,
      );
      const enqueue = await enqueueCandidates(queue, candidates);
      result.rss = {
        ...enqueue,
        errors,
      };
    }
  }

  return result;
}
