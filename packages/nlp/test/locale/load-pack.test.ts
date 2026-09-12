import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { LanguagePackError, loadLanguagePack } from "../../src/index.js";

const root = mkdtempSync(join(tmpdir(), "concordance-pack-"));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function packDirectory(name: string, pack: string, stopwords = "a\nb\n"): URL {
  const directory = join(root, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "pack.yaml"), pack);
  writeFileSync(join(directory, "stopwords.txt"), stopwords);
  return pathToFileURL(`${directory}/`);
}

describe("loadLanguagePack", () => {
  it("reads a pack from its folder, with a trailing slash or without", () => {
    const url = packDirectory(
      "de",
      "locale: de\nlanguage: Deutsch\ncollation: { numeric: true }\nplural: []\n",
    );
    const pack = loadLanguagePack(url);
    expect(pack.locale).toBe("de");
    expect(pack.language).toBe("Deutsch");
    expect(pack.stopwords).toEqual(new Set(["a", "b"]));
    expect(loadLanguagePack(new URL(url.href.slice(0, -1))).locale).toBe("de");
  });

  it("defaults the minimum length of a plural rule to one more than its ending", () => {
    const url = packDirectory(
      "es",
      "locale: es\nlanguage: Español\ncollation: {}\nplural: [{ ending: es, singular: '' }]\n",
    );
    expect(loadLanguagePack(url).plural).toEqual([{ ending: "es", singular: "", minLength: 3 }]);
  });

  it("normalises with the apostrophes the pack declares", () => {
    const url = packDirectory(
      "it",
      "locale: it\nlanguage: Italiano\napostrophes: ['’']\ncollation: {}\nplural: []\n",
    );
    expect(loadLanguagePack(url).normalize("L’Aquila")).toBe("l'aquila");
  });

  it("rejects a pack that does not match the schema, naming the folder and the key", () => {
    const url = packDirectory("bad", "locale: pt\ncollation: {}\nplural: []\n");
    expect(() => loadLanguagePack(url)).toThrow(LanguagePackError);
    expect(() => loadLanguagePack(url)).toThrow(
      /language pack at .*bad\/: error: pack\.yaml: language: required key is missing/,
    );
  });

  it("rejects a pack whose tag passes the schema but is not a valid language tag", () => {
    const url = packDirectory(
      "weird",
      "locale: 'en-abc'\nlanguage: X\ncollation: {}\nplural: []\n",
    );
    expect(() => loadLanguagePack(url)).toThrow(/"en-abc" is not a valid language tag/);
  });
});
