import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

function resolveDatabasePath(databaseUrl: string): string {
  const url = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  return path.isAbsolute(url) ? url : path.resolve(process.cwd(), url);
}

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/bot-queue.db";
const dbPath = resolveDatabasePath(databaseUrl);
const migrationsDir = path.resolve(process.cwd(), "drizzle");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const statements = sql
    .split(/--> statement-breakpoint\n?/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (
        message.includes("duplicate column name") ||
        message.includes("already exists")
      ) {
        continue;
      }
      throw error;
    }
  }
  console.log(`Applied ${file}`);
}

console.log(`Migrated database at ${dbPath}`);
