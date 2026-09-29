import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkStylesheets, rulesOf } from "../check-stylesheets.mjs";

const roots = [];
/** No pair is deliberate in these trees: the real list belongs to the repository, not to a fixture. */
const NONE = new Map();

/** A tree with the folders the check reads: the stylesheets, the sources and the snapshots. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "stylesheets-"));
  roots.push(root);
  for (const directory of [
    "packages/site/assets/css",
    "packages/site/src",
    "packages/site/test/gallery/__snapshots__",
    "packages/site/test/helpers",
  ]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("the rules of a stylesheet", () => {
  it("reads a selector with the at-rules around it and ignores comments", () => {
    expect(
      rulesOf(`/* a comment { .not-a-rule } */
.bar { color: red }
@media (min-width: 30rem) { @supports (display: grid) { .bar { display: grid } } }
@font-face { font-family: X }`),
    ).toEqual([
      { selector: ".bar", context: "" },
      { selector: ".bar", context: "@media (min-width: 30rem) | @supports (display: grid)" },
      { selector: "@font-face", context: "" },
    ]);
  });
});

describe("the stylesheets of the site", () => {
  it("accepts one rule declared once, with its class emitted by a template", () => {
    const root = tree({
      "packages/site/assets/css/bar.css": ".bar {\n  color: red;\n}\n",
      "packages/site/src/bar.tsx": 'export const bar = <div class="bar" />;\n',
    });
    expect(checkStylesheets(root, NONE)).toEqual([]);
  });

  it("refuses the same selector declared twice in one file, in the same context", () => {
    const root = tree({
      "packages/site/assets/css/bar.css":
        ".bar {\n  color: red;\n}\n.bar {\n  color: blue;\n}\n@media print {\n  .bar {\n    color: black;\n  }\n}\n",
      "packages/site/src/bar.tsx": 'export const bar = <div class="bar" />;\n',
    });
    expect(checkStylesheets(root, NONE)).toEqual([
      "packages/site/assets/css/bar.css: declares .bar twice; one rule, one place",
    ]);
  });

  it("refuses a selector declared in two files when the pair carries no reason", () => {
    const root = tree({
      "packages/site/assets/css/a.css": ".lonely {\n  color: red;\n}\n",
      "packages/site/assets/css/b.css": ".lonely {\n  color: blue;\n}\n",
      "packages/site/src/bar.tsx": 'export const bar = <div class="lonely" />;\n',
    });
    expect(checkStylesheets(root, NONE)).toEqual([
      "packages/site/assets/css/b.css: declares .lonely, already declared in packages/site/assets/css/a.css; merge them, or name the pair in scripts/check-stylesheets.mjs with the reason",
    ]);
  });

  it("accepts the pair of a selector the list names", () => {
    const root = tree({
      "packages/site/assets/css/a.css": ".titled {\n  color: red;\n}\n",
      "packages/site/assets/css/b.css": ".titled {\n  flex: 1;\n}\n",
      "packages/site/src/bar.tsx": 'export const bar = <div class="titled" />;\n',
    });
    expect(checkStylesheets(root, new Map([[".titled", "the reason of the pair"]]))).toEqual([]);
  });

  it("reports a reason left behind once the pair is gone", () => {
    const root = tree({
      "packages/site/assets/css/a.css": ".alone {\n  color: red;\n}\n",
      "packages/site/src/bar.tsx": 'export const bar = <div class="alone" />;\n',
    });
    expect(checkStylesheets(root, new Map([[".gone", "a reason nobody needs"]]))).toEqual([
      "scripts/check-stylesheets.mjs: .gone is named as declared in two files but is not; remove it from the list",
    ]);
  });

  it("refuses a class no template, island or rendered page emits", () => {
    const root = tree({
      "packages/site/assets/css/bar.css": ".ghost {\n  color: red;\n}\n",
      "packages/site/src/bar.tsx": "export const bar = 1;\n",
    });
    expect(checkStylesheets(root, NONE)).toContain(
      "packages/site/assets/css/bar.css: styles .ghost, which no template, island or rendered page emits; remove the rule",
    );
  });

  it("takes a rendered page as evidence: a class the templates compose at run time", () => {
    const root = tree({
      "packages/site/assets/css/bar.css": ".pins-menu-list {\n  margin: 0;\n}\n",
      "packages/site/src/pins.ts": "export const kind = (name) => `pins-menu-${name}`;\n",
      "packages/site/test/gallery/__snapshots__/page.skeleton.html":
        '<ul class="pins-menu-list"></ul>\n',
    });
    expect(checkStylesheets(root, NONE)).toEqual([]);
  });
});
