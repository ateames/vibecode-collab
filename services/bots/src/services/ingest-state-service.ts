import { eq } from "drizzle-orm";
import { ingestSourceState } from "../db/schema.js";
import type { Db } from "../db/client.js";
import { nowIso } from "../lib/time.js";

export type IngestStateRecord = {
  sourceKey: string;
  readmeSha: string | null;
  knownLinks: string[];
  updatedAt: string;
};

export class IngestStateService {
  constructor(private db: Db) {}

  async get(sourceKey: string): Promise<IngestStateRecord | null> {
    const rows = await this.db
      .select()
      .from(ingestSourceState)
      .where(eq(ingestSourceState.sourceKey, sourceKey))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    let knownLinks: string[] = [];
    try {
      knownLinks = JSON.parse(row.knownLinksJson) as string[];
    } catch {
      knownLinks = [];
    }
    return {
      sourceKey: row.sourceKey,
      readmeSha: row.readmeSha,
      knownLinks,
      updatedAt: row.updatedAt,
    };
  }

  async save(record: Omit<IngestStateRecord, "updatedAt">): Promise<void> {
    const updatedAt = nowIso();
    await this.db
      .insert(ingestSourceState)
      .values({
        sourceKey: record.sourceKey,
        readmeSha: record.readmeSha,
        knownLinksJson: JSON.stringify(record.knownLinks),
        updatedAt,
      })
      .onConflictDoUpdate({
        target: ingestSourceState.sourceKey,
        set: {
          readmeSha: record.readmeSha,
          knownLinksJson: JSON.stringify(record.knownLinks),
          updatedAt,
        },
      });
  }
}
