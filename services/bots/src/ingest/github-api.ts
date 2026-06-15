export type GitHubSearchRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  archived: boolean;
  pushed_at: string;
  topics?: string[];
  default_branch?: string;
};

export type GitHubApiConfig = {
  GITHUB_TOKEN?: string;
  PAGE_FETCH_TIMEOUT_MS?: number;
  PAGE_FETCH_MAX_BYTES?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 500_000;
const README_TEXT_MAX = 8000;

export function buildGitHubHeaders(
  token?: string,
  accept = "application/vnd.github+json",
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vibecode-collab-bots",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithLimits(
  url: string,
  config: GitHubApiConfig,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = config.PAGE_FETCH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export type ReadmeFetchResult = {
  content: string;
  sha: string | null;
};

export async function fetchReadmeRaw(
  fullName: string,
  config: GitHubApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadmeFetchResult | null> {
  const headers = buildGitHubHeaders(config.GITHUB_TOKEN, "application/vnd.github.raw");

  try {
    const response = await fetchWithLimits(
      `https://api.github.com/repos/${fullName}/readme`,
      config,
      fetchImpl,
      { headers },
    );
    if (!response.ok) {
      return null;
    }
    const maxBytes = config.PAGE_FETCH_MAX_BYTES ?? DEFAULT_MAX_BYTES;
    const text = (await readResponseText(response, maxBytes))
      .replace(/\s+/g, " ")
      .trim();
    const sha = response.headers.get("x-github-sha");
    return text.length > 0
      ? { content: truncate(text, README_TEXT_MAX), sha }
      : null;
  } catch {
    return null;
  }
}

export async function fetchReadmeMarkdown(
  fullName: string,
  config: GitHubApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ content: string; sha: string | null } | null> {
  const headers = buildGitHubHeaders(config.GITHUB_TOKEN);

  try {
    const response = await fetchWithLimits(
      `https://api.github.com/repos/${fullName}/readme`,
      config,
      fetchImpl,
      { headers },
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      content?: string;
      encoding?: string;
      sha?: string;
    };
    if (data.encoding === "base64" && data.content) {
      const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
        "utf-8",
      );
      return { content: decoded, sha: data.sha ?? null };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchRepoDefaultBranch(
  fullName: string,
  config: GitHubApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const repo = await fetchRepo(fullName, config, fetchImpl);
  return repo?.default_branch ?? "main";
}

type GitHubRepoResponse = GitHubSearchRepo & {
  default_branch?: string;
};

export async function fetchRepo(
  fullName: string,
  config: GitHubApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubRepoResponse | null> {
  const headers = buildGitHubHeaders(config.GITHUB_TOKEN);

  try {
    const response = await fetchWithLimits(
      `https://api.github.com/repos/${fullName}`,
      config,
      fetchImpl,
      { headers },
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as GitHubRepoResponse;
    return data;
  } catch {
    return null;
  }
}
