import { config as loadEnv } from "dotenv";
import { buildCommunityLookupCandidates } from "../src/lib/community-lookup.js";
import { LemmyPostingService } from "../src/services/lemmy-client.js";

loadEnv();

type CommunityTarget = {
  envKey: string;
  label: string;
  configuredName: string;
};

async function resolveOne(
  lemmy: LemmyPostingService,
  instanceHost: string,
  target: CommunityTarget,
): Promise<boolean> {
  const candidates = buildCommunityLookupCandidates(
    target.configuredName,
    instanceHost,
  );

  for (const candidate of candidates) {
    const id = await lemmy.resolveCommunityIdByName(candidate);
    if (id) {
      console.log(
        `${target.envKey}=${id}  # ${target.label} (resolved as ${candidate})`,
      );
      return true;
    }
  }

  console.error(
    `# Could not resolve ${target.label}: configured ${target.envKey.replace("_ID", "_NAME")}=${JSON.stringify(target.configuredName)}`,
  );
  console.error(`  Tried: ${candidates.join(", ")}`);
  return false;
}

async function main() {
  const baseUrl = (process.env.LEMMY_BASE_URL ?? "http://localhost:1236").replace(
    /\/$/,
    "",
  );
  const lemmy = new LemmyPostingService(baseUrl);
  const instanceHost = await lemmy.getInstanceHostname();

  console.log(`# Instance: ${baseUrl} (community host: ${instanceHost})`);
  console.log(
    "# Set *_COMMUNITY_NAME to the Lemmy community slug (see /c/<slug>), not the display title.",
  );
  console.log("");

  const targets: CommunityTarget[] = [
    {
      envKey: "AI_TOOL_NEWS_COMMUNITY_ID",
      label: "ai_tool_news_bot",
      configuredName:
        process.env.AI_TOOL_NEWS_COMMUNITY_NAME ?? "tools_and_workflows",
    },
    {
      envKey: "GITHUB_PROJECTS_BOT_COMMUNITY_ID",
      label: "github_projects_bot",
      configuredName:
        process.env.GITHUB_PROJECTS_BOT_COMMUNITY_NAME ?? "github_projects",
    },
  ];

  const results = await Promise.all(
    targets.map((target) => resolveOne(lemmy, instanceHost, target)),
  );

  if (results.some((ok) => !ok)) {
    console.error("");
    console.error("# Local communities on this instance:");
    const communities = await lemmy.listLocalCommunities();
    if (communities.length === 0) {
      console.error("  (none found — create communities in Lemmy admin first)");
    } else {
      for (const community of communities) {
        console.error(
          `  ${community.id}  ${community.name}  (${community.title})`,
        );
      }
    }
    console.error("");
    console.error(
      "# Create missing communities in Lemmy, or point *_COMMUNITY_NAME at an existing slug above.",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
