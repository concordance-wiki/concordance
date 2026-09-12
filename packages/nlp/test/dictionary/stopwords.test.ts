import { memoryFileSystem, type Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { dictionaryStopwords, glossarySources, languagePack } from "../../src/index.js";

const configDirectory = "/project";

function config(inference: Config["inference"], sources: Config["sources"] = []): Config {
  const base: Config = { version: 1, project: { name: "Test" }, sources };
  return inference === undefined ? base : { ...base, inference };
}

describe.each(["en", "fr"] as const)(
  "configured stopwords are excluded from the dictionary: the %s stopword set",
  (locale) => {
    const defaults = languagePack(locale).stopwords;

    it("is the pack's default list when no file is configured", () => {
      const fs = memoryFileSystem();
      expect(
        dictionaryStopwords({ locale, config: config(undefined), configDirectory, fs }),
      ).toEqual(defaults);
      expect(dictionaryStopwords({ locale, config: config({}), configDirectory, fs })).toEqual(
        defaults,
      );
    });

    it("adds the words of every configured file, resolved against the configuration directory", () => {
      const fs = memoryFileSystem({
        "/project/stopwords/domain.txt": "# domain noise\nfoo\nBAR\n",
        "/project/more.txt": "baz # trailing comment\nfoo\n",
      });
      const words = dictionaryStopwords({
        locale,
        config: config({ stopwords: ["./stopwords/domain.txt", "more.txt"] }),
        configDirectory,
        fs,
      });
      expect(words.size).toBe(defaults.size + 3);
      expect([...words].filter((word) => !defaults.has(word)).sort()).toEqual([
        "bar",
        "baz",
        "foo",
      ]);
      for (const word of defaults) expect(words.has(word), word).toBe(true);
    });

    it("throws a plain error naming a missing file", () => {
      const fs = memoryFileSystem({ "/project/present.txt": "foo\n" });
      expect(() =>
        dictionaryStopwords({
          locale,
          config: config({ stopwords: ["present.txt", "absent.txt"] }),
          configDirectory,
          fs,
        }),
      ).toThrow(
        new Error(
          'stopword file not found: /project/absent.txt (inference.stopwords lists "absent.txt")',
        ),
      );
    });

    it("does not modify the pack's own set", () => {
      const before = defaults.size;
      const fs = memoryFileSystem({ "/project/extra.txt": "zzz-extra\n" });
      dictionaryStopwords({
        locale,
        config: config({ stopwords: ["extra.txt"] }),
        configDirectory,
        fs,
      });
      expect(languagePack(locale).stopwords.size).toBe(before);
      expect(languagePack(locale).stopwords.has("zzz-extra")).toBe(false);
    });
  },
);

describe("glossarySources names the priority sources of the dictionary", () => {
  const sources: Config["sources"] = [
    { name: "glossary", path: "./glossary", glossary: true },
    { name: "specs", path: "./specs" },
    { name: "terms", path: "./terms", glossary: true },
    { name: "notes", path: "./notes", glossary: false },
  ];

  it("takes inference.glossary_sources when declared, even empty", () => {
    expect(glossarySources(config({ glossary_sources: ["specs"] }, sources))).toEqual(
      new Set(["specs"]),
    );
    expect(glossarySources(config({ glossary_sources: [] }, sources))).toEqual(new Set());
  });

  it("falls back to the sources marked glossary: true", () => {
    expect(glossarySources(config(undefined, sources))).toEqual(new Set(["glossary", "terms"]));
    expect(glossarySources(config({}, sources))).toEqual(new Set(["glossary", "terms"]));
  });
});
