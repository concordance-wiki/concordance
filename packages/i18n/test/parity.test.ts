import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { argumentsOf, parseMessage, type ArgumentKind } from "../src/arguments.js";
import { argumentNames, messageArguments, messageIds, type MessageId } from "../src/ids.js";
import { shipped, shippedLanguages, SOURCE_LANGUAGE } from "../src/shipped.js";

const directory = new URL("../messages/", import.meta.url);

function readCatalogue(name: string): Record<string, unknown> {
  // The catalogue files are JSON objects by construction; the shape of their values is checked below.
  return JSON.parse(readFileSync(new URL(name, directory), "utf8")) as Record<string, unknown>;
}

function signature(message: string): string[] {
  const parsed = parseMessage(message);
  if (!parsed.ok) throw new Error(parsed.reason);
  return [...argumentsOf(parsed.elements)].map(([name, kind]) => `${name}:${kind}`);
}

const translations = shippedLanguages.filter((language) => language !== SOURCE_LANGUAGE);

describe("message catalogues", () => {
  it("ship one JSON file per language, the source being en", () => {
    expect(readdirSync(directory).sort()).toEqual(shippedLanguages.map((l) => `${l}.json`));
    expect(SOURCE_LANGUAGE).toBe("en");
    expect(translations).toEqual(["fr"]);
  });

  it("keep every entry of the source with a default message and a one-sentence description", () => {
    const source = readCatalogue("en.json");
    for (const id of Object.keys(source)) {
      // The shape of a source entry is what this test verifies, field by field.
      const entry = source[id] as { defaultMessage?: unknown; description?: unknown };
      expect(Object.keys(entry).sort(), id).toEqual(["defaultMessage", "description"]);
      expect(typeof entry.defaultMessage, id).toBe("string");
      expect(entry.description, id).toMatch(/^[A-Z][^.]+\.$/);
    }
  });

  it("keep every entry of a translation as a plain string", () => {
    for (const language of translations) {
      const catalogue = readCatalogue(`${language}.json`);
      for (const id of Object.keys(catalogue)) {
        expect(typeof catalogue[id], `${language}: ${id}`).toBe("string");
      }
    }
  });

  it("sort their keys so that diffs stay stable", () => {
    for (const language of shippedLanguages) {
      const keys = Object.keys(readCatalogue(`${language}.json`));
      expect(keys, language).toEqual([...keys].sort());
    }
  });

  it("carry every key of the source in each shipped locale, with the same variables and types", () => {
    const source = shipped[SOURCE_LANGUAGE];
    expect(source).toBeDefined();
    for (const language of translations) {
      const catalogue = shipped[language];
      expect(catalogue).toBeDefined();
      expect(Object.keys(catalogue ?? {}).sort(), language).toEqual([...messageIds]);
      for (const id of messageIds) {
        expect(signature(catalogue?.[id] ?? ""), `${language}: ${id}`).toEqual(
          signature(source?.[id] ?? ""),
        );
      }
    }
  });

  it("declare in code the argument names and kinds the source catalogue parses to", () => {
    const source = shipped[SOURCE_LANGUAGE];
    for (const id of messageIds) {
      const parsed = parseMessage(source?.[id] ?? "");
      if (!parsed.ok) throw new Error(parsed.reason);
      const expected = Object.fromEntries(argumentsOf(parsed.elements));
      expect(messageArguments[id], id).toEqual(expected);
      expect(argumentNames[id], id).toEqual(Object.keys(expected).sort());
    }
  });

  it("list every identifier of the source catalogue in sorted order", () => {
    expect(messageIds).toEqual(Object.keys(readCatalogue("en.json")));
    expect(messageIds).toHaveLength(156);
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
