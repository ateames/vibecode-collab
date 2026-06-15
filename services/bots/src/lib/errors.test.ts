import { describe, expect, it } from "vitest";
import { formatError } from "./errors.js";

describe("formatError", () => {
  it("returns Error message", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
  });

  it("formats lemmy-js-client plain object errors", () => {
    expect(
      formatError({ name: "couldnt_find_community", message: "" }),
    ).toBe("couldnt_find_community");
  });

  it("prefers message over name when both are set", () => {
    expect(
      formatError({
        name: "validation_error",
        message: "Title is too long",
      }),
    ).toBe("Title is too long");
  });

  it("stringifies unknown object shapes", () => {
    expect(formatError({ code: 400, details: ["bad"] })).toBe(
      '{"code":400,"details":["bad"]}',
    );
  });
});
