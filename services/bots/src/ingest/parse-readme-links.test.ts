import { describe, expect, it } from "vitest";
import {
  diffNewLinks,
  parseGitHubFullNameFromUrl,
  parseReadmeLinks,
} from "./parse-readme-links.js";

describe("parse-readme-links", () => {
  it("parses external github repo links from kyrolabs-style bullets", () => {
    const markdown = `
- [OpenClaw](https://github.com/openclaw/openclaw): Open-source AI agent framework
- [Badge](https://img.shields.io/github/stars/openclaw/openclaw?style=social)
- [Stars page](https://github.com/openclaw/openclaw/stargazers)
`;
    const links = parseReadmeLinks(markdown, "kyrolabs/awesome-agents", {
      resolveMonorepoPaths: true,
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.fullName).toBe("openclaw/openclaw");
    expect(links[0]?.url).toBe("https://github.com/openclaw/openclaw");
  });

  it("resolves relative monorepo paths to tree URLs", () => {
    const markdown = `
* [🛫 AI Travel Agent](starter_ai_agents/ai_travel_agent/)
* [External](https://github.com/accomplish-ai/openwork) ↗ external
`;
    const links = parseReadmeLinks(
      markdown,
      "Shubhamsaboo/awesome-llm-apps",
      {
        resolveMonorepoPaths: true,
        defaultBranch: "main",
      },
    );
    expect(links).toHaveLength(2);
    expect(links[0]?.url).toBe(
      "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_travel_agent",
    );
    expect(links[0]?.isMonorepoPath).toBe(true);
    expect(links[1]?.fullName).toBe("accomplish-ai/openwork");
  });

  it("parses tree paths from external github links", () => {
    const { fullName, treePath } = parseGitHubFullNameFromUrl(
      "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_travel_agent",
    );
    expect(fullName).toBe("Shubhamsaboo/awesome-llm-apps");
    expect(treePath).toBe("starter_ai_agents/ai_travel_agent");
  });

  it("diffNewLinks returns only unseen URLs", () => {
    const all = parseReadmeLinks(
      "- [A](https://github.com/a/a)\n- [B](https://github.com/b/b)",
      "x/y",
      { resolveMonorepoPaths: false },
    );
    const known = new Set(["https://github.com/a/a"]);
    const fresh = diffNewLinks(all, known);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.url).toBe("https://github.com/b/b");
  });
});
