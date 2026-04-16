import { describe, expect, it } from "vitest";

import { OnboardingRoute } from "@/routes/_dashboard/onboarding";

describe("Onboarding route", () => {
  it("redirects to the new project wizard", () => {
    const node = OnboardingRoute();

    expect(node.props.to).toBe("/projects/new");
    expect(node.props.search).toEqual({ step: 1 });
    expect(node.props.replace).toBe(true);
  });
});
