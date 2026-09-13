import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseTheme } from "../../src/config/load.js";
import { validateTheme } from "../../src/config/theme.js";
import { schemaIssues } from "../../src/config/validate.js";

const palette = {
  bg: "#F6F5F2",
  surface: "#FFFFFF",
  border: "#E4E1DA",
  ink: "#16181B",
  muted: "#4E5259",
  accent: "#B84820",
};

const minimal = { name: "Pipeline notes", light: palette, dark: palette };

describe("The project name, logo, accent colour, corner radius and font families come from theme.yaml, validated by schemas/theme.schema.json", () => {
  it("accepts a minimal theme and returns it typed, without any issue", () => {
    const result = validateTheme(minimal);
    expect(result).toEqual({ ok: true, theme: minimal, issues: [] });
  });

  it("accepts every documented key, the credit and the assets folder included", () => {
    const full = {
      ...minimal,
      logo: "mark.svg",
      favicon: "favicon.svg",
      font: { display: "Literata", ui: "Public Sans", mono: "JetBrains Mono" },
      radius: 2,
      default_mode: "dark",
      footer: {
        text: "Kept by its maintainers.",
        links: [{ label: "Forge", url: "../" }],
        credit: true,
      },
      stylesheet: "site.css",
      assets: "assets",
      labels: { en: { "site.home": "Start" } },
    };
    const result = validateTheme(full);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.theme.footer?.credit).toBe(true);
      expect(result.theme.assets).toBe("assets");
    }
  });

  it("reports the path of every required key missing, palettes included", () => {
    expect(validateTheme({}).issues.map((issue) => issue.path)).toEqual(["name", "light", "dark"]);
    const result = validateTheme({ ...minimal, dark: { bg: "#000000" } });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "dark.surface",
      "dark.border",
      "dark.ink",
      "dark.muted",
      "dark.accent",
    ]);
    expect(result.issues[0]).toEqual({
      severity: "error",
      path: "dark.surface",
      message: "required key is missing",
    });
  });

  it("reports a colour that is not #RRGGBB with the path of the key and the value received", () => {
    const result = validateTheme({ ...minimal, light: { ...palette, accent: "orange" } });
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "light.accent",
        message: "value does not match the expected format",
        received: "orange",
        expected: "a value matching ^#[0-9A-Fa-f]{6}$",
      },
    ]);
  });

  it("reports an unknown key, the retired mention_tool included, a wrong type and a mode outside the enumeration", () => {
    expect(validateTheme({ ...minimal, footer: { mention_tool: true } }).issues).toEqual([
      {
        severity: "error",
        path: "footer.mention_tool",
        message: "unknown key",
        expected: "one of the documented keys",
      },
    ]);
    expect(validateTheme({ ...minimal, radius: "8px" }).issues).toEqual([
      {
        severity: "error",
        path: "radius",
        message: "wrong type",
        received: "8px",
        expected: "integer",
      },
    ]);
    expect(validateTheme({ ...minimal, default_mode: "auto" }).issues).toEqual([
      {
        severity: "error",
        path: "default_mode",
        message: "value is not allowed",
        received: "auto",
        expected: 'one of "light", "dark", "system"',
      },
    ]);
  });

  it("refuses a label block for a language that is not en or fr, naming the language", () => {
    const result = validateTheme({ ...minimal, labels: { de: { "site.home": "Start" } } });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "labels.de",
        message: "key is not allowed",
        received: "de",
        expected: 'one of "en", "fr"',
      },
    ]);
  });

  it("validates the brand theme shipped with the repository", () => {
    const text = readFileSync(new URL("../../../../brand/theme.yaml", import.meta.url), "utf8");
    const result = parseTheme(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.theme.name).toBe("Concordance");
      expect(result.theme.radius).toBe(8);
      expect(result.theme.font?.display).toBe("Instrument Serif");
    }
  });

  it("reports YAML that cannot be parsed before looking at the schema", () => {
    const result = parseTheme("name: [unclosed\n");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: "error", path: "" });
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: /);
  });
});

describe("schemaIssues", () => {
  it("validates a document against the published schema of that name", () => {
    expect(schemaIssues("theme", minimal)).toEqual([]);
    expect(schemaIssues("config", minimal).map((issue) => issue.path)).toEqual([
      "version",
      "project",
      "sources",
      "name",
      "light",
      "dark",
    ]);
  });
});
