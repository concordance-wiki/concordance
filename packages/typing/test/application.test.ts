import { describe, expect, it } from "vitest";

import { resolveApplication, type ResolveApplicationInput } from "../src/application.js";
import { APPLICATIONS, sourceConfig } from "./helpers.js";

function resolve(
  overrides: Partial<ResolveApplicationInput> = {},
): ReturnType<typeof resolveApplication> {
  return resolveApplication({
    source: sourceConfig({ application: "concordance-cli" }),
    ruleDefaults: {},
    frontmatterApplication: undefined,
    applications: APPLICATIONS,
    ...overrides,
  });
}

describe("resolveApplication", () => {
  it("resolves the application by the same cascade: frontmatter over rule over source", () => {
    expect(resolve()).toEqual({ application: "concordance-cli", origin: "source", declared: true });
    expect(
      resolve({ ruleDefaults: { application: "concordance-service", audience: "internal" } }),
    ).toEqual({
      application: "concordance-service",
      origin: "rule",
      declared: true,
    });
    expect(
      resolve({
        ruleDefaults: { application: "concordance-service" },
        frontmatterApplication: "concordance-cli",
      }),
    ).toEqual({ application: "concordance-cli", origin: "frontmatter", declared: true });
  });

  it("resolves to no application when neither the frontmatter, a rule nor the source sets one", () => {
    expect(resolve({ source: sourceConfig() })).toEqual({ origin: "none", declared: false });
    expect(resolve({ source: sourceConfig(), ruleDefaults: { audience: "internal" } })).toEqual({
      origin: "none",
      declared: false,
    });
  });

  it("keeps an application the configuration does not declare and marks it undeclared", () => {
    expect(resolve({ frontmatterApplication: "forge-bridge" })).toEqual({
      application: "forge-bridge",
      origin: "frontmatter",
      declared: false,
    });
    expect(resolve({ source: sourceConfig({ application: "legacy" }) })).toEqual({
      application: "legacy",
      origin: "source",
      declared: false,
    });
    expect(resolve({ applications: [] }).declared).toBe(false);
  });

  it("serialises a frontmatter application that is not a string so that the finding shows it", () => {
    expect(resolve({ frontmatterApplication: ["concordance-cli"] })).toEqual({
      application: '["concordance-cli"]',
      origin: "frontmatter",
      declared: false,
    });
  });
});
