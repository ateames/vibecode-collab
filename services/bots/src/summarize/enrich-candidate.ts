import {
  type SummarizerConfig,
  isSummarizerActive,
} from "../config.js";
import type { IngestCandidate } from "../ingest/types.js";
import {
  extractContentForCandidate,
  getSourceAttribution,
  type ExtractContentDeps,
} from "./extract-content.js";
import { summarizeText, type SummarizeDeps } from "./summarize.js";

export type EnrichCandidateDeps = ExtractContentDeps & SummarizeDeps;

export async function enrichCandidateWithSummary(
  candidate: IngestCandidate,
  config: SummarizerConfig,
  deps: EnrichCandidateDeps = {},
): Promise<IngestCandidate> {
  if (!isSummarizerActive(config)) {
    return candidate;
  }

  if (candidate.sourceType === "manual" && !candidate.url?.trim()) {
    return candidate;
  }

  try {
    const content = await extractContentForCandidate(candidate, config, deps);
    if (!content) {
      return candidate;
    }

    const summary = await summarizeText(candidate.title, content, config, deps);
    if (!summary) {
      return candidate;
    }

    const source = getSourceAttribution(candidate);
    return {
      ...candidate,
      body: `${summary}\n\nSource: ${source}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Summary failed for "${candidate.title}" (${candidate.url}): ${message}`,
    );
    return candidate;
  }
}
