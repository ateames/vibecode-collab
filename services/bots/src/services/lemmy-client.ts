import { LemmyHttp } from "lemmy-js-client";
import { getBotCredentials, getLemmyBaseUrl } from "../config.js";
import { formatError } from "../lib/errors.js";
import type { BotAccount } from "../db/schema.js";

type JwtCacheEntry = {
  jwt: string;
  expiresAt: number;
};

const JWT_TTL_MS = 55 * 60 * 1000;

export class LemmyPostingService {
  private readonly jwtCache = new Map<BotAccount, JwtCacheEntry>();

  constructor(private readonly baseUrl: string = getLemmyBaseUrl()) {}

  private createClient(jwt?: string): LemmyHttp {
    const client = new LemmyHttp(this.baseUrl);
    if (jwt) {
      client.setHeaders({ Authorization: `Bearer ${jwt}` });
    }
    return client;
  }

  private async getJwt(botAccount: BotAccount): Promise<string> {
    const cached = this.jwtCache.get(botAccount);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.jwt;
    }

    const creds = getBotCredentials(botAccount);
    const client = this.createClient();
    const response = await client.login({
      username_or_email: creds.username,
      password: creds.password,
    });

    if (!response.jwt) {
      throw new Error(`Lemmy login failed for ${botAccount}: no JWT returned`);
    }

    this.jwtCache.set(botAccount, {
      jwt: response.jwt,
      expiresAt: Date.now() + JWT_TTL_MS,
    });
    return response.jwt;
  }

  async createPost(input: {
    botAccount: BotAccount;
    communityId: number;
    title: string;
    url?: string | null;
    body?: string | null;
  }): Promise<{
    postId: number;
    postUrl: string;
    responseJson: string;
  }> {
    const jwt = await this.getJwt(input.botAccount);
    const client = this.createClient(jwt);

    const { post_view } = await client.createPost({
      community_id: input.communityId,
      name: input.title,
      url: input.url ?? undefined,
      body: input.body ?? undefined,
    });

    if (!post_view?.post?.id) {
      throw new Error("Lemmy createPost succeeded but returned no post id");
    }

    const postId = post_view.post.id;
    const postUrl = this.buildPostUrl(postId);

    return {
      postId,
      postUrl,
      responseJson: JSON.stringify({ post_view }),
    };
  }

  buildPostUrl(postId: number): string {
    const base = this.baseUrl.replace(/\/$/, "");
    return `${base}/post/${postId}`;
  }

  async saveUserSettingsAsBot(botAccount: BotAccount): Promise<void> {
    const jwt = await this.getJwt(botAccount);
    const client = this.createClient(jwt);
    await client.saveUserSettings({ bot_account: true });
  }

  async getInstanceHostname(): Promise<string> {
    const client = this.createClient();
    const { site_view } = await client.getSite();
    const actorId = site_view?.site?.actor_id;
    if (actorId) {
      return new URL(actorId).hostname;
    }
    return new URL(this.baseUrl).hostname;
  }

  async listLocalCommunities(limit = 50): Promise<
    Array<{ id: number; name: string; title: string }>
  > {
    const client = this.createClient();
    const { communities } = await client.listCommunities({
      limit,
      type_: "Local",
    });
    return (communities ?? [])
      .map((row) => row.community)
      .filter((community): community is NonNullable<typeof community> =>
        Boolean(community?.id && community.name),
      )
      .map((community) => ({
        id: community.id,
        name: community.name,
        title: community.title,
      }));
  }

  async resolveCommunityIdByName(name: string): Promise<number | null> {
    try {
      const client = this.createClient();
      const response = await client.getCommunity({ name });
      return response.community_view?.community?.id ?? null;
    } catch {
      return null;
    }
  }
}

export async function postQueueItemToLemmy(
  lemmy: LemmyPostingService,
  item: {
    botAccount: BotAccount;
    targetCommunityId: number;
    title: string;
    url: string | null;
    body: string | null;
  },
): Promise<{ postId: number; postUrl: string; responseJson: string }> {
  try {
    return await lemmy.createPost({
      botAccount: item.botAccount,
      communityId: item.targetCommunityId,
      title: item.title,
      url: item.url,
      body: item.body,
    });
  } catch (error) {
    throw new Error(formatError(error));
  }
}
