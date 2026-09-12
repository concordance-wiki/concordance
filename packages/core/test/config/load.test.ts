import { describe, expect, it } from "vitest";

import { parseConfig } from "../../src/config/load.js";

describe("parseConfig", () => {
  it("parses YAML then validates it", () => {
    const result = parseConfig(
      "version: 1\nproject: { name: W }\nsources: [{ name: a, path: . }]\n",
    );
    expect(result.ok).toBe(true);
  });

  it("reports YAML that cannot be parsed, with the parser's first line of explanation", () => {
    const result = parseConfig("version: 1\nproject: [unclosed\n");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: "error", path: "" });
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: .+/);
    expect(result.issues[0]?.message).not.toContain("\n");
  });

  it("reports a document that is not a mapping", () => {
    const result = parseConfig("just a string\n");
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ path: "", message: "wrong type", expected: "object" });
  });
});
