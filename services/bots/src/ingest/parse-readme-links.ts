export type ParsedReadmeLink = {
  url: string;
  label: string;
  fullName: string | null;
  treePath: string | null;
  isMonorepoPath: boolean;
};

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const SKIP_HOSTS = new Set(["img.shields.io", "shields.io"]);
const SKIP_GITHUB_PATH_SUFFIXES = ["/stargazers", "/issues", "/pulls", "/graphs"];

function isAnchorOnly(href: string): boolean {
  return href.startsWith("#");
}

function isSkippedExternalUrl(url: URL): boolean {
  if (SKIP_HOSTS.has(url.hostname)) {
    return true;
  }
  if (url.hostname !== "github.com") {
    return false;
  }
  const path = url.pathname.toLowerCase();
  return SKIP_GITHUB_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

export function parseGitHubFullNameFromUrl(urlString: string): {
  fullName: string | null;
  treePath: string | null;
} {
  try {
    const url = new URL(urlString);
    if (url.hostname !== "github.com") {
      return { fullName: null, treePath: null };
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return { fullName: null, treePath: null };
    }
    const fullName = `${parts[0]}/${parts[1]}`;
    if (parts[2] === "tree" && parts.length > 4) {
      return { fullName, treePath: parts.slice(4).join("/") };
    }
    if (parts[2] === "blob" && parts.length > 4) {
      return { fullName, treePath: parts.slice(4).join("/") };
    }
    return { fullName, treePath: null };
  } catch {
    return { fullName: null, treePath: null };
  }
}

function normalizeRelativePath(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || isAnchorOnly(trimmed)) {
    return null;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  ) {
    return null;
  }
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveMonorepoTreeUrl(
  listFullName: string,
  relativePath: string,
  defaultBranch: string,
): string {
  const [owner, repo] = listFullName.split("/");
  const path = relativePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return `https://github.com/${owner}/${repo}/tree/${defaultBranch}/${path}`;
}

function shouldSkipListRoot(fullName: string, listFullName: string, treePath: string | null): boolean {
  return fullName === listFullName && !treePath;
}

export function parseReadmeLinks(
  markdown: string,
  listFullName: string,
  options: {
    resolveMonorepoPaths: boolean;
    defaultBranch?: string;
  },
): ParsedReadmeLink[] {
  const seen = new Set<string>();
  const results: ParsedReadmeLink[] = [];
  const defaultBranch = options.defaultBranch ?? "main";

  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    const label = match[1]?.trim() ?? "";
    const href = match[2]?.trim() ?? "";
    if (!href) {
      continue;
    }

    if (href.startsWith("http://") || href.startsWith("https://")) {
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        continue;
      }
      if (isSkippedExternalUrl(url)) {
        continue;
      }
      if (url.hostname !== "github.com") {
        continue;
      }
      const cleanUrl = href.split("#")[0] ?? href;
      const { fullName, treePath } = parseGitHubFullNameFromUrl(cleanUrl);
      if (!fullName || shouldSkipListRoot(fullName, listFullName, treePath)) {
        continue;
      }
      if (seen.has(cleanUrl)) {
        continue;
      }
      seen.add(cleanUrl);
      results.push({
        url: cleanUrl,
        label,
        fullName,
        treePath,
        isMonorepoPath: false,
      });
      continue;
    }

    if (!options.resolveMonorepoPaths) {
      continue;
    }

    const relativePath = normalizeRelativePath(href);
    if (!relativePath) {
      continue;
    }

    const treeUrl = resolveMonorepoTreeUrl(
      listFullName,
      relativePath,
      defaultBranch,
    );
    if (seen.has(treeUrl)) {
      continue;
    }
    seen.add(treeUrl);
    results.push({
      url: treeUrl,
      label,
      fullName: listFullName,
      treePath: relativePath,
      isMonorepoPath: true,
    });
  }

  return results;
}

export function diffNewLinks(
  allLinks: ParsedReadmeLink[],
  knownUrls: Set<string>,
): ParsedReadmeLink[] {
  return allLinks.filter((link) => !knownUrls.has(link.url));
}
