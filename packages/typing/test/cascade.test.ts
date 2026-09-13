import type { Finding, TypingRule } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { resolveType, ruleMatches } from "../src/cascade.js";
import { profile, sourceConfig } from "./helpers.js";

const PROFILE = profile();

function resolve(
  rules: TypingRule[],
  path: string,
  frontmatter: Record<string, unknown> = {},
  overrides: { type?: string; default_type?: string } = {},
) {
  const source = sourceConfig({ ...overrides, ...(rules.length === 0 ? {} : { rules }) });
  return resolveType({ source, path, frontmatter, profile: PROFILE });
}

const screenRule: TypingRule = { match: { path: "screens/**" }, set: { type: "screen" } };
const ruleSuffix: TypingRule = { match: { suffix: ".rule.md" }, set: { type: "rule" } };

describe("the type cascade", () => {
  describe("increasing precedence", () => {
    it("starts from document when the source declares nothing", () => {
      expect(resolve([], "notes/a.md")).toEqual({
        type: "document",
        origin: "source",
        defaults: {},
        findings: [],
      });
    });

    it("uses the source's default_type when nothing else applies", () => {
      const resolved = resolve([], "a.md", {}, { default_type: "meeting" });
      expect([resolved.type, resolved.origin]).toEqual(["meeting", "source"]);
    });

    it("lets the source's type win over its default_type", () => {
      const resolved = resolve([], "a.md", {}, { default_type: "meeting", type: "rule" });
      expect([resolved.type, resolved.origin]).toEqual(["rule", "source"]);
    });

    it("lets a matching rule win over the source's type", () => {
      const resolved = resolve([screenRule], "screens/a.md", {}, { type: "rule" });
      expect([resolved.type, resolved.origin]).toEqual(["screen", "rule#1"]);
    });

    it("evaluates the rules in order and the last match wins", () => {
      const rules: TypingRule[] = [
        { match: { path: "screens/**" }, set: { type: "screen" } },
        { match: { path: "**/*.md" }, set: { type: "rule" } },
        { match: { path: "nothing/**" }, set: { type: "meeting" } },
      ];
      const resolved = resolve(rules, "screens/a.md");
      expect([resolved.type, resolved.origin]).toEqual(["rule", "rule#2"]);
    });

    it("lets the frontmatter type win over every rule", () => {
      const resolved = resolve([screenRule], "screens/a.md", { type: "rule" });
      expect([resolved.type, resolved.origin]).toEqual(["rule", "frontmatter"]);
      expect(resolved.findings).toEqual([]);
    });
  });

  describe("rule criteria", () => {
    const frontmatter = { date: "2026-03-12" };

    it("accepts a path glob", () => {
      expect(ruleMatches({ path: "screens/**" }, "screens/deep/a.md", {})).toBe(true);
      expect(ruleMatches({ path: "screens/**" }, "api/a.md", {})).toBe(false);
    });

    it("accepts a suffix", () => {
      expect(ruleMatches({ suffix: ".rule.md" }, "rules/cap.rule.md", {})).toBe(true);
      expect(ruleMatches({ suffix: ".rule.md" }, "rules/cap.md", {})).toBe(false);
    });

    it("accepts a list of extensions", () => {
      expect(ruleMatches({ ext: [".vtt", ".srt"] }, "meetings/a.srt", {})).toBe(true);
      expect(ruleMatches({ ext: [".vtt", ".srt"] }, "meetings/a.md", {})).toBe(false);
    });

    it("accepts a frontmatter key that must be present", () => {
      expect(ruleMatches({ frontmatter: "date" }, "a.md", frontmatter)).toBe(true);
      expect(ruleMatches({ frontmatter: "date" }, "a.md", { date: null })).toBe(true);
      expect(ruleMatches({ frontmatter: "date" }, "a.md", {})).toBe(false);
    });

    it("needs every criterion of a rule with several", () => {
      const match = { path: "meetings/**", ext: [".md"], frontmatter: "date" };
      expect(ruleMatches(match, "meetings/a.md", frontmatter)).toBe(true);
      expect(ruleMatches(match, "meetings/a.md", {})).toBe(false);
      expect(ruleMatches(match, "meetings/a.txt", frontmatter)).toBe(false);
      expect(ruleMatches(match, "notes/a.md", frontmatter)).toBe(false);
    });

    it("stringifies a rule type that is not a string before looking it up", () => {
      const resolved = resolve([{ match: { path: "**" }, set: { type: 3 } }], "a.md");
      expect(resolved.type).toBe("document");
      expect(resolved.findings.map((finding) => finding.check)).toEqual(["W-TYPE-UNKNOWN"]);
      expect(resolved.findings[0]?.message).toContain('type "3"');
    });
  });

  describe("type origin", () => {
    it("is kept as source, rule#<n>, suffix or frontmatter", () => {
      const rules = [screenRule, ruleSuffix];
      expect(resolve(rules, "notes/a.md", {}, { type: "meeting" }).origin).toBe("source");
      expect(resolve(rules, "screens/a.md").origin).toBe("rule#1");
      expect(resolve(rules, "rules/a.rule.md").origin).toBe("suffix");
      expect(resolve(rules, "notes/a.md", { type: "screen" }).origin).toBe("frontmatter");
    });

    it("names the matching rule by its 1-based position, suffix rules aside", () => {
      const rules: TypingRule[] = [
        ruleSuffix,
        { match: { path: "api/**" }, set: { type: "screen" } },
        { match: { path: "objects/**" }, set: { type: "rule" } },
      ];
      expect(resolve(rules, "api/a.md").origin).toBe("rule#2");
      expect(resolve(rules, "objects/a.md").origin).toBe("rule#3");
    });
  });

  describe("type conflict", () => {
    const conflict: Finding = {
      check: "E-TYPE-CONFLICT",
      severity: "error",
      source: "specs",
      path: "rules/cap.rule.md",
      message:
        'frontmatter type "screen" of rules/cap.rule.md contradicts the type "rule" given by the file suffix; the frontmatter is kept',
      remediation:
        "Align the frontmatter type with the suffix, or drop the type key and let the filing convention decide.",
    };

    it("reports E-TYPE-CONFLICT when the frontmatter type contradicts the file suffix", () => {
      const resolved = resolve([ruleSuffix], "rules/cap.rule.md", { type: "screen" });
      expect(resolved).toEqual({
        type: "screen",
        origin: "frontmatter",
        defaults: {},
        findings: [conflict],
      });
    });

    it("stays quiet when the frontmatter type agrees with the suffix", () => {
      const resolved = resolve([ruleSuffix], "rules/cap.rule.md", { type: "rule" });
      expect([resolved.origin, resolved.findings]).toEqual(["frontmatter", []]);
    });

    it("stays quiet when the type the frontmatter contradicts came from a path rule", () => {
      const resolved = resolve([ruleSuffix, screenRule], "screens/cap.rule.md", { type: "rule" });
      expect([resolved.type, resolved.origin, resolved.findings]).toEqual([
        "rule",
        "frontmatter",
        [],
      ]);
    });
  });

  describe("unknown type", () => {
    const unknown = (type: string, origin: string, path = "a.md"): Finding => ({
      check: "W-TYPE-UNKNOWN",
      severity: "warning",
      source: "specs",
      path,
      message: `type "${type}" of ${path} (from ${origin}) is not declared by the profile; the note is treated as a document`,
      remediation:
        "Use a type of the profile, declare the type in the project profile, or fix the source rule or the frontmatter that sets it.",
    });

    it("yields W-TYPE-UNKNOWN and treats the note as a document, origin kept", () => {
      expect(resolve([], "a.md", { type: "regulation" })).toEqual({
        type: "document",
        origin: "frontmatter",
        defaults: {},
        findings: [unknown("regulation", "frontmatter")],
      });
    });

    it("checks the type whatever its origin", () => {
      expect(resolve([], "a.md", {}, { type: "regulation" })).toEqual({
        type: "document",
        origin: "source",
        defaults: {},
        findings: [unknown("regulation", "source")],
      });
      const byRule = resolve([{ match: { path: "**" }, set: { type: "regulation" } }], "a.md");
      expect(byRule.origin).toBe("rule#1");
      expect(byRule.findings).toEqual([unknown("regulation", "rule#1")]);
      const bySuffix = resolve(
        [{ match: { suffix: ".reg.md" }, set: { type: "regulation" } }],
        "a.reg.md",
      );
      expect(bySuffix.origin).toBe("suffix");
      expect(bySuffix.findings).toEqual([unknown("regulation", "suffix", "a.reg.md")]);
    });

    it("reports a frontmatter type that is not a string as its JSON", () => {
      const resolved = resolve([], "a.md", { type: ["screen"] });
      expect(resolved.type).toBe("document");
      expect(resolved.findings).toEqual([unknown('["screen"]', "frontmatter")]);
    });

    it("reports both the conflict and the unknown type when they combine", () => {
      const resolved = resolve([ruleSuffix], "rules/cap.rule.md", { type: "regulation" });
      expect(resolved.findings.map((finding) => finding.check)).toEqual([
        "E-TYPE-CONFLICT",
        "W-TYPE-UNKNOWN",
      ]);
    });
  });

  describe("attribute defaults", () => {
    it("records the other set keys of every matching rule, in rule order", () => {
      const rules: TypingRule[] = [
        { match: { path: "roles/**" }, set: { type: "screen", kind: "entity", level: 1 } },
        { match: { path: "roles/admin/**" }, set: { level: 2, internal: true } },
        { match: { path: "nothing/**" }, set: { kind: "nobody" } },
      ];
      const resolved = resolve(rules, "roles/admin/a.md");
      expect(resolved.type).toBe("screen");
      expect(resolved.defaults).toEqual({ kind: "entity", level: 2, internal: true });
    });
  });
});
