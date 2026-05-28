import { describe, expect, it } from "vitest";
import { buildCommunityLookupCandidates } from "./community-lookup.js";

describe("buildCommunityLookupCandidates", () => {
  it("uses slug and slug@host for plain names", () => {
    expect(
      buildCommunityLookupCandidates(
        "tools_and_workflows",
        "lemmy.vibecodecollab.com",
      ),
    ).toEqual([
      "tools_and_workflows",
      "tools_and_workflows@lemmy.vibecodecollab.com",
    ]);
  });

  it("derives slug variants from display titles", () => {
    const candidates = buildCommunityLookupCandidates(
      "AI Coding Tool Updates",
      "lemmy.example.com",
    );
    expect(candidates).toContain("AI Coding Tool Updates");
    expect(candidates).toContain("ai_coding_tool_updates");
    expect(candidates).toContain("ai_coding_tool_updates@lemmy.example.com");
  });

  it("parses /c/slug URLs", () => {
    expect(
      buildCommunityLookupCandidates(
        "https://lemmy.example.com/c/tools_and_workflows",
        "lemmy.example.com",
      ),
    ).toEqual([
      "tools_and_workflows",
      "tools_and_workflows@lemmy.example.com",
    ]);
  });

  it("passes through federated names unchanged", () => {
    expect(
      buildCommunityLookupCandidates(
        "programming@lemmy.ml",
        "lemmy.example.com",
      ),
    ).toEqual(["programming@lemmy.ml"]);
  });
});
