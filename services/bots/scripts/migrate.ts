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
const migrationPath = path.resolve(
  process.cwd(),
  "drizzle/0000_init.sql",
);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

const sql = fs.readFileSync(migrationPath, "utf8");
const statements = sql
  .split(/--> statement-breakpoint\n?/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  db.exec(statement);
}

console.log(`Migrated database at ${dbPath}`);
