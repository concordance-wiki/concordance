import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AREAS } from "../src/areas.js";
import { argumentsOf, parseMessage, type ArgumentKind } from "../src/arguments.js";
import {
  argumentNames,
  french,
  messageArguments,
  messageIds,
  source,
  type MessageId,
} from "../src/ids.js";
import { shipped, shippedLanguages, SOURCE_LANGUAGE } from "../src/shipped.js";

const directory = new URL("../messages/", import.meta.url);

function readCatalogue(language: string, area: string): Record<string, unknown> {
  // The catalogue files are JSON objects by construction; the shape of their values is checked below.
  return JSON.parse(readFileSync(new URL(`${language}/${area}.json`, directory), "utf8")) as Record<
    string,
    unknown
  >;
}

function areaFiles(language: string): string[] {
  return readdirSync(new URL(`${language}/`, directory)).sort();
}

/** The identifier prefix an area is named after, read from its own identifiers. */
function prefixOf(ids: readonly string[]): string {
  const prefixes = new Set(ids.map((id) => id.slice(0, id.indexOf("."))));
  expect(prefixes.size, ids.join(", ")).toBe(1);
  return [...prefixes][0] ?? "";
}

function signature(message: string): string[] {
  const parsed = parseMessage(message);
  if (!parsed.ok) throw new Error(parsed.reason);
  return [...argumentsOf(parsed.elements)].map(([name, kind]) => `${name}:${kind}`);
}

const translations = shippedLanguages.filter((language) => language !== SOURCE_LANGUAGE);
const areaNames = AREAS.map((area) => prefixOf(Object.keys(area.en)));

describe("message catalogues", () => {
  it("ship one folder per language, the source being en, with one JSON file per area", () => {
    expect(readdirSync(directory).sort()).toEqual(shippedLanguages);
    expect(SOURCE_LANGUAGE).toBe("en");
    expect(translations).toEqual(["fr"]);
    for (const language of shippedLanguages) {
      expect(areaFiles(language), language).toEqual(areaNames.map((area) => `${area}.json`));
    }
  });

  it("list the areas in the order of their prefixes, each module carrying the files of its area", () => {
    expect(areaNames).toEqual([...areaNames].sort());
    expect(new Set(areaNames).size).toBe(areaNames.length);
    for (const [index, area] of AREAS.entries()) {
      const name = areaNames[index] ?? "";
      expect(area.en, name).toEqual(readCatalogue("en", name));
      expect(area.fr, name).toEqual(readCatalogue("fr", name));
      expect(Object.keys(area.arguments), name).toEqual(Object.keys(area.en));
    }
  });

  it("keep every entry of the source with a default message and a one-sentence description", () => {
    for (const area of areaNames) {
      const file = readCatalogue("en", area);
      for (const id of Object.keys(file)) {
        // The shape of a source entry is what this test verifies, field by field.
        const entry = file[id] as { defaultMessage?: unknown; description?: unknown };
        expect(Object.keys(entry).sort(), id).toEqual(["defaultMessage", "description"]);
        expect(typeof entry.defaultMessage, id).toBe("string");
        expect(entry.description, id).toMatch(/^[A-Z][^.]+\.$/);
      }
    }
  });

  it("keep every entry of a translation as a plain string", () => {
    for (const language of translations) {
      for (const area of areaNames) {
        const file = readCatalogue(language, area);
        for (const id of Object.keys(file)) {
          expect(typeof file[id], `${language}: ${id}`).toBe("string");
        }
      }
    }
  });

  it("sort the keys of every file, each under the prefix the file is named after", () => {
    for (const language of shippedLanguages) {
      for (const area of areaNames) {
        const keys = Object.keys(readCatalogue(language, area));
        expect(keys, `${language}/${area}`).toEqual([...keys].sort());
        expect(keys.length, `${language}/${area}`).toBeGreaterThan(0);
        for (const key of keys) expect(key.startsWith(`${area}.`), key).toBe(true);
      }
    }
  });

  it("carry every key of the source in each shipped locale, with the same variables and types", () => {
    const en = shipped[SOURCE_LANGUAGE];
    expect(en).toBeDefined();
    for (const language of translations) {
      const catalogue = shipped[language];
      expect(catalogue).toBeDefined();
      expect(Object.keys(catalogue ?? {}), language).toEqual([...messageIds]);
      for (const id of messageIds) {
        expect(signature(catalogue?.[id] ?? ""), `${language}: ${id}`).toEqual(
          signature(en?.[id] ?? ""),
        );
      }
    }
  });

  it("declare in code the argument names and kinds the source catalogue parses to", () => {
    for (const id of messageIds) {
      const parsed = parseMessage(source[id].defaultMessage);
      if (!parsed.ok) throw new Error(parsed.reason);
      const expected = Object.fromEntries(argumentsOf(parsed.elements));
      expect(messageArguments[id], id).toEqual(expected);
      expect(argumentNames[id], id).toEqual(Object.keys(expected).sort());
    }
  });

  it("list every identifier of every area in sorted order, the count read from the files", () => {
    const fromFiles = areaNames.flatMap((area) => Object.keys(readCatalogue("en", area)));
    expect(messageIds).toEqual([...fromFiles].sort());
    expect(messageIds).toHaveLength(fromFiles.length);
    expect(Object.keys(source)).toEqual(fromFiles);
    expect(Object.keys(french)).toEqual(fromFiles);
    expect(shipped[SOURCE_LANGUAGE] && Object.keys(shipped[SOURCE_LANGUAGE])).toEqual([
      ...messageIds,
    ]);
  });

  it("use only the argument kinds a build can supply, never a tag", () => {
    const kinds = new Set<ArgumentKind>();
    for (const id of messageIds) {
      for (const kind of Object.values<ArgumentKind>(messageArguments[id])) kinds.add(kind);
    }
    expect([...kinds].sort()).toEqual(["argument", "date", "number", "plural"]);
  });

  it("type the identifiers from the source catalogue", () => {
    const id: MessageId = "site.home";
    expect(messageIds).toContain(id);
  });
});
