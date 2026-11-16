import { describe, expect, it } from "vitest";

import { levelOneHeadsSections, titleFromPath } from "../../src/identity/title.js";

describe("titleFromPath", () => {
  it("drops the folders and the extension and reads underscores as spaces", () => {
    expect(titleFromPath("specs/SPEC_Billing__rules_v3.md")).toBe("SPEC Billing rules v3");
  });

  it("keeps hyphens, case and accents as written", () => {
    expect(titleFromPath("notes/Contrat-cadre Réseau.docx")).toBe("Contrat-cadre Réseau");
  });

  it("keeps the base name when underscores are all there is", () => {
    expect(titleFromPath("specs/___.md")).toBe("___");
  });
});

describe("levelOneHeadsSections", () => {
  it("reads one H1 as the title and several as sections under auto", () => {
    expect(levelOneHeadsSections(undefined, 0)).toBe(false);
    expect(levelOneHeadsSections("auto", 1)).toBe(false);
    expect(levelOneHeadsSections("auto", 2)).toBe(true);
  });

  it("reads every H1 as a section under sections", () => {
    expect(levelOneHeadsSections("sections", 1)).toBe(true);
    expect(levelOneHeadsSections("sections", 0)).toBe(true);
  });
});
