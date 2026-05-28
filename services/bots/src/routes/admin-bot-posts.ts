import { Hono } from "hono";
import type { BotAccount } from "../db/schema.js";
import { formatError } from "../lib/errors.js";
import { requireAdminAuth } from "../middleware/auth.js";
import {
  LemmyPostingService,
  postQueueItemToLemmy,
} from "../services/lemmy-client.js";
import { QueueService } from "../services/queue-service.js";

export function createAdminBotPostsRoutes(
  queue: QueueService,
  lemmy: LemmyPostingService,
) {
  const app = new Hono();

  app.use("*", requireAdminAuth);

  app.get("/pending", async (c) => {
    const items = await queue.listPending();
    return c.json({ items });
  });

  app.post("/:id/ignore", async (c) => {
    const id = c.req.param("id");
    try {
      const item = await queue.ignore(id);
      if (!item) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.json({ item });
    } catch (error) {
      return c.json({ error: formatError(error) }, 400);
    }
  });

  app.post("/:id/post", async (c) => {
    const id = c.req.param("id");
    const claimed = await queue.claimForPosting(id);
    if (!claimed) {
      return c.json(
        { error: "Not found or not in a postable state (pending/failed)" },
        404,
      );
    }

    try {
      const result = await postQueueItemToLemmy(lemmy, {
        botAccount: claimed.botAccount as BotAccount,
        targetCommunityId: claimed.targetCommunityId,
        title: claimed.title,
        url: claimed.url,
        body: claimed.body,
      });

      const item = await queue.markPosted(id, {
        lemmyPostId: result.postId,
        lemmyPostUrl: result.postUrl,
        lemmyResponseJson: result.responseJson,
      });

      return c.json({ item, lemmy: result });
    } catch (error) {
      const message = formatError(error);
      const item = await queue.markFailed(id, message);
      return c.json({ error: message, item }, 502);
    }
  });

  return app;
}
