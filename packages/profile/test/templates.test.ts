import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { loadDefaultProfile } from "../src/load.js";

const templates = fileURLToPath(new URL("../../../docs/templates", import.meta.url));

interface Note {
  path: string;
  frontmatter: Record<string, unknown>;
}

function readNote(name: string): Note {
  const text = readFileSync(join(templates, name), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  // A template without frontmatter is a valid note that carries no attribute.
  const frontmatter: unknown = match === null ? {} : parse(match[1] ?? "");
  if (typeof frontmatter !== "object" || frontmatter === null || Array.isArray(frontmatter)) {
    throw new Error(`${name}: the frontmatter is not a mapping`);
  }
  // The guard above leaves a plain object; its values are read as unknown.
  return { path: name, frontmatter: frontmatter as Record<string, unknown> };
}

/**
 * The type cascade of a source, by increasing precedence: `default_type`, `type`, the rules in order,
 * the frontmatter. A source without any of them types every note as a document.
 */
function resolveType(
  note: Note,
  source: { default_type?: string; type?: string; rules?: { suffix: string; type: string }[] },
): string {
  let type = source.default_type ?? "document";
  if (source.type !== undefined) type = source.type;
  for (const rule of source.rules ?? []) {
    if (note.path.endsWith(rule.suffix)) type = rule.type;
  }
  const declared = note.frontmatter["type"];
  return typeof declared === "string" ? declared : type;
}

const notes = readdirSync(templates)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort()
  .map(readNote);

const activeTypes = Object.entries(loadDefaultProfile().types)
  .filter(([, definition]) => definition.status === "active")
  .map(([type]) => type)
  .sort();

describe("the note templates against the default profile", () => {
  it("cover every active type with a template that the cascade resolves to that type", () => {
    const resolved = notes.map((note) => resolveType(note, {})).sort();
    expect(resolved).toEqual(activeTypes);
  });

  it("declare their type in the frontmatter, so that it wins over any source rule", () => {
    const rules = [{ suffix: ".md", type: "document" }];
    for (const note of notes) {
      expect(resolveType(note, { type: "term", rules }), note.path).toBe(
        note.path.replace(/\.md$/, ""),
      );
    }
  });

  it("name the file after the type, as the README table lists them", () => {
    const table = readFileSync(join(templates, "README.md"), "utf8");
    for (const type of activeTypes) {
      expect(table).toContain(`| ${type} | [${type}.md](${type}.md) |`);
    }
  });
});
