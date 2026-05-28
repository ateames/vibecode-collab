import type { BotAccount, SourceType } from "../db/schema.js";

export type IngestCandidate = {
  title: string;
  url: string;
  body: string;
  botAccount: BotAccount;
  targetCommunity: string;
  targetCommunityId: number;
  sourceType: SourceType;
  sourceExternalId: string;
  sourceUrl: string;
};

export type IngestSourceResult = {
  inserted: number;
  skipped: number;
  errors: string[];
};

export type IngestRunResult = {
  github: IngestSourceResult;
  rss: IngestSourceResult;
};
