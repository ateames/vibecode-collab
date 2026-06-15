import { fetchReadmeRaw } from "../ingest/github-api.js";
import type { SummarizerConfig } from "../config.js";
import type { IngestCandidate } from "../ingest/types.js";

const SOURCE_TEXT_MAX = 8000;

export type ExtractContentDeps = {
  fetchImpl?: typeof fetch;
};

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseGitHubRepoFullName(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

async function fetchWithLimits(
  url: string,
  config: SummarizerConfig,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.PAGE_FETCH_TIMEOUT_MS,
  );
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "vibecode-collab-bots",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) {
      break;
    }
    chunks.push(value);
    total += value.length;
  }

  await reader.cancel().catch(() => undefined);

  const combined = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, maxBytes - offset);
    combined.set(slice, offset);
    offset += slice.length;
    if (offset >= maxBytes) {
      break;
    }
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

export async function fetchPageText(
  url: string,
  config: SummarizerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchWithLimits(url, config, fetchImpl);
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }
    const html = await readResponseText(response, config.PAGE_FETCH_MAX_BYTES);
    const text = stripHtml(html);
    return text.length > 0 ? truncate(text, SOURCE_TEXT_MAX) : null;
  } catch {
    return null;
  }
}

export async function fetchGitHubReadme(
  fullName: string,
  config: SummarizerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const result = await fetchReadmeRaw(fullName, config, fetchImpl);
  return result?.content ?? null;
}

function extractRssBodyText(body: string): string {
  const lines = body
    .split("\n\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const withoutSource = lines.filter((line) => !line.startsWith("Source:"));
  const withoutPublished = withoutSource.filter(
    (line) => !line.startsWith("Published:"),
  );
  return withoutPublished.join("\n\n").trim();
}

export async function extractContentForCandidate(
  candidate: IngestCandidate,
  config: SummarizerConfig,
  deps: ExtractContentDeps = {},
): Promise<string | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (candidate.sourceType === "manual") {
    if (!candidate.url?.trim()) {
      return null;
    }
    return candidate.body?.trim()
      ? truncate(candidate.body.trim(), SOURCE_TEXT_MAX)
      : fetchPageText(candidate.url, config, fetchImpl);
  }

  if (candidate.sourceType === "github_project") {
    const fullName = parseGitHubRepoFullName(candidate.url);
    if (fullName) {
      const readme = await fetchGitHubReadme(fullName, config, fetchImpl);
      if (readme) {
        return readme;
      }
    }
    return candidate.body?.trim()
      ? truncate(candidate.body.trim(), SOURCE_TEXT_MAX)
      : null;
  }

  if (candidate.sourceType === "ai_tool_news") {
    const excerpt = extractRssBodyText(candidate.body ?? "");
    if (excerpt.length >= config.SUMMARY_MIN_SOURCE_CHARS) {
      return truncate(excerpt, SOURCE_TEXT_MAX);
    }
    if (candidate.url?.trim()) {
      const pageText = await fetchPageText(candidate.url, config, fetchImpl);
      if (pageText) {
        return pageText;
      }
    }
    return excerpt.length > 0 ? truncate(excerpt, SOURCE_TEXT_MAX) : null;
  }

  return candidate.body?.trim()
    ? truncate(candidate.body.trim(), SOURCE_TEXT_MAX)
    : null;
}

export function getSourceAttribution(candidate: IngestCandidate): string {
  if (candidate.sourceType === "github_project") {
    return "GitHub";
  }
  if (candidate.sourceType === "ai_tool_news") {
    const match = candidate.body?.match(/^Source:\s*(.+)$/m);
    return match?.[1]?.trim() || "RSS";
  }
  return candidate.sourceUrl || candidate.url || "Link";
}
