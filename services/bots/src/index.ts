import { serve } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { getEnv } from "./config.js";
import { createDb } from "./db/client.js";
import { createAdminBotPostsRoutes } from "./routes/admin-bot-posts.js";
import { LemmyPostingService } from "./services/lemmy-client.js";
import { QueueService } from "./services/queue-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

async function main() {
  const env = getEnv();
  const db = createDb(env.DATABASE_URL);
  const queue = new QueueService(db);
  const resetCount = await queue.resetStalePosting();
  if (resetCount > 0) {
    console.log(
      `Marked ${resetCount} interrupted posting item(s) as failed`,
    );
  }
  const lemmy = new LemmyPostingService();

  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/admin", async (c) => {
    const html = await readFile(path.join(publicDir, "admin.html"), "utf8");
    return c.html(html);
  });

  app.route(
    "/admin/bot-posts",
    createAdminBotPostsRoutes(queue, lemmy, db),
  );

  serve(
    {
      fetch: app.fetch,
      hostname: env.HOST,
      port: env.PORT,
    },
    () => {
      console.log(
        `Bot admin service listening on http://${env.HOST}:${env.PORT}`,
      );
      console.log(`Admin UI: http://${env.HOST}:${env.PORT}/admin`);
    },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
