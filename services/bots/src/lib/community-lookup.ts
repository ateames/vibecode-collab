/**
 * Build Lemmy `GET /community?name=…` lookup values.
 *
 * Local communities use the slug (`community.name`). Federated communities use
 * `slug@instance.tld` (see Lemmy API GetCommunity).
 */
export function buildCommunityLookupCandidates(
  input: string,
  instanceHost: string,
): string[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const fromUrl = extractCommunitySlugFromUrl(trimmed);
  if (fromUrl) {
    return unique([fromUrl, `${fromUrl}@${instanceHost}`]);
  }

  if (trimmed.includes("@")) {
    return [trimmed];
  }

  const slug = toCommunitySlug(trimmed);
  return unique(
    [trimmed, slug, `${trimmed}@${instanceHost}`, `${slug}@${instanceHost}`].filter(
      (value): value is string => Boolean(value),
    ),
  );
}

export function extractCommunitySlugFromUrl(input: string): string | null {
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/c\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function toCommunitySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
