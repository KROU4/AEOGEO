import { describe, expect, it } from "vitest";

import { buildAbsoluteShareUrl, formatVisibilityScore } from "./report";

describe("report helpers", () => {
  it("builds an absolute share URL from a relative path", () => {
    expect(
      buildAbsoluteShareUrl(
        "/shared/reports/abc123",
        "https://sand-source.com/dashboard",
      ),
    ).toBe("https://sand-source.com/shared/reports/abc123");
  });

  it("formats visibility scores on a 0-10 scale", () => {
    expect(formatVisibilityScore(7)).toBe("7.0");
    expect(formatVisibilityScore(7.26)).toBe("7.3");
  });
});
