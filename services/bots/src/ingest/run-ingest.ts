import {
  getEnv,
  getIngestCommunityConfig,
  getSummarizerConfig,
  type IngestSource,
} from "../config.js";
import type { QueueService } from "../services/queue-service.js";
import { collectGitHubCandidates } from "./github-search.js";
import { fetchRssCandidates } from "./rss.js";
import type { IngestCandidate, IngestRunResult, IngestSourceResult } from "./types.js";
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

export async function runIngest(
  queue: QueueService,
  sources: IngestSource[],
): Promise<IngestRunResult> {
  const env = getEnv();
  const communities = getIngestCommunityConfig();

  const result: IngestRunResult = {
    github: { inserted: 0, skipped: 0, errors: [] },
    rss: { inserted: 0, skipped: 0, errors: [] },
  };

  if (sources.includes("github")) {
    if (!env.GITHUB_SEARCH_QUERY.trim()) {
      result.github.errors.push("GITHUB_SEARCH_QUERY is not configured");
    } else {
      try {
        const { candidates } = await collectGitHubCandidates(
          env,
          communities.githubProjectsCommunityName,
          communities.githubProjectsCommunityId,
        );
        result.github = await enqueueCandidates(queue, candidates);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.github.errors.push(message);
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
