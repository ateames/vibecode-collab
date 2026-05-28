import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { Env } from "../config.js";
import type { IngestCandidate } from "./types.js";

export type RssConfig = Pick<
  Env,
  "AI_NEWS_RSS_URLS" | "AI_NEWS_MAX_ITEMS_PER_FEED" | "AI_NEWS_MAX_AGE_DAYS"
>;

const TITLE_MAX = 200;
const BODY_EXCERPT_MAX = 500;

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "vibecode-collab-bots",
  },
});

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hashLink(link: string): string {
  return createHash("sha256").update(link).digest("hex").slice(0, 16);
}

export function buildRssExternalId(feedUrl: string, guidOrLink: string): string {
  let host = "unknown";
  try {
    host = new URL(feedUrl).hostname;
  } catch {
    // keep unknown
  }
  return `rss:${host}:${hashLink(guidOrLink)}`;
}

export function feedItemToCandidate(
  feedUrl: string,
  feedTitle: string,
  item: Parser.Item,
  targetCommunity: string,
  targetCommunityId: number,
): IngestCandidate | null {
  const link = item.link?.trim() || item.guid?.trim();
  if (!link) {
    return null;
  }

  const title = truncate(stripHtml(item.title?.trim() || "Untitled"), TITLE_MAX);
  const pubDate = item.pubDate || item.isoDate || "";
  const rawContent =
    item.contentSnippet || item.content || item.summary || "";
  const excerpt = truncate(stripHtml(rawContent), BODY_EXCERPT_MAX);
  const bodyParts = [
    `Source: ${feedTitle || feedUrl}`,
    pubDate ? `Published: ${pubDate}` : null,
    excerpt ? excerpt : null,
  ].filter(Boolean);

  const guidOrLink = item.guid?.trim() || link;

  return {
    title,
    url: link,
    body: bodyParts.join("\n\n"),
    botAccount: "ai_tool_news_bot",
    targetCommunity,
    targetCommunityId,
    sourceType: "ai_tool_news",
    sourceExternalId: buildRssExternalId(feedUrl, guidOrLink),
    sourceUrl: link,
  };
}

export function isItemWithinMaxAge(
  item: Parser.Item,
  maxAgeDays: number,
  now: Date = new Date(),
): boolean {
  const dateStr = item.isoDate || item.pubDate;
  if (!dateStr) {
    return true;
  }
  const published = new Date(dateStr);
  if (Number.isNaN(published.getTime())) {
    return true;
  }
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return now.getTime() - published.getTime() <= maxAgeMs;
}

export async function fetchRssCandidates(
  config: RssConfig,
  targetCommunity: string,
  targetCommunityId: number,
  parseFeed: (
    url: string,
  ) => Promise<Parser.Output<Record<string, unknown>>> = (url) =>
    parser.parseURL(url),
): Promise<{ candidates: IngestCandidate[]; errors: string[] }> {
  const candidates: IngestCandidate[] = [];
  const errors: string[] = [];

  for (const feedUrl of config.AI_NEWS_RSS_URLS) {
    try {
      const feed = await parseFeed(feedUrl);
      const feedTitle = feed.title?.trim() || feedUrl;
      const items = (feed.items ?? []).slice(
        0,
        config.AI_NEWS_MAX_ITEMS_PER_FEED,
      );

      for (const item of items) {
        if (!isItemWithinMaxAge(item, config.AI_NEWS_MAX_AGE_DAYS)) {
          continue;
        }
        const candidate = feedItemToCandidate(
          feedUrl,
          feedTitle,
          item,
          targetCommunity,
          targetCommunityId,
        );
        if (candidate) {
          candidates.push(candidate);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${feedUrl}: ${message}`);
    }
  }

  return { candidates, errors };
}
