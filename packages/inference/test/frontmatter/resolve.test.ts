import { describe, expect, it } from "vitest";

import type { LinkableEntity } from "../../src/explicit/types.js";
import { indexEntities, resolveReference } from "../../src/frontmatter/resolve.js";

function entity(
  id: string,
  type: string,
  title: string,
  source: { name: string; path: string },
): LinkableEntity {
  return { id, type, title, attributes: {}, source };
}

const screen = entity("specs/screens/entry", "screen", "Mentions panel", {
  name: "specs",
  path: "screens/entry.md",
});
const role = entity("specs/roles/maintainer", "role", "Maintainer", {
  name: "specs",
  path: "roles/maintainer.md",
});
const cap = entity("specs/rules/related-cap", "rule", "Related cap", {
  name: "specs",
  path: "rules/related-cap.rule.md",
});
const object = entity("specs/objects/link", "business_object", "Link", {
  name: "specs",
  path: "objects/link.md",
});
const term = entity("glossary/link", "term", "Link", {
  name: "glossary",
  path: "link.md",
});
const renamed = entity("specs/roles/theme", "role", "Theme author", {
  name: "specs",
  path: "roles/Theme Author.md",
});

const index = indexEntities([screen, role, cap, object, term, renamed]);

function resolve(value: string, from: LinkableEntity = screen) {
  return resolveReference(value, { from, index });
}

describe("indexEntities", () => {
  it("keys entities by identifier, by source-qualified path and by trimmed title", () => {
    const spaced = entity("specs/roles/clerk", "role", "  Clerk ", {
      name: "specs",
      path: "roles/clerk.md",
    });
    const built = indexEntities([spaced, role]);
    expect([...built.byId.keys()]).toEqual(["specs/roles/clerk", "specs/roles/maintainer"]);
    expect([...built.byPath.keys()]).toEqual(["specs/roles/clerk.md", "specs/roles/maintainer.md"]);
    expect([...built.byTitle.keys()]).toEqual(["Clerk", "Maintainer"]);
  });

  it("keeps the first entity of a repeated identifier or path and every entity of a repeated title", () => {
    const twin = entity("specs/objects/link", "term", "Link", {
      name: "specs",
      path: "objects/link.md",
    });
    const built = indexEntities([object, twin, term]);
    expect(built.byId.get("specs/objects/link")).toBe(object);
    expect(built.byPath.get("specs/objects/link.md")).toBe(object);
    expect(built.byTitle.get("Link")).toEqual([object, twin, term]);
  });
});

describe("resolveReference", () => {
  it("resolves a full identifier", () => {
    expect(resolve("specs/roles/maintainer")).toEqual({
      kind: "resolved",
      entity: role,
      by: "id",
    });
  });

  it("resolves an identifier relative to the source of the referring note", () => {
    expect(resolve("roles/maintainer")).toEqual({ kind: "resolved", entity: role, by: "id" });
    expect(resolve("link", term)).toEqual({ kind: "resolved", entity: term, by: "id" });
    expect(resolve("link")).toEqual({ kind: "unresolved" });
  });

  it("resolves a source-relative path, type suffix and extension included", () => {
    expect(resolve("roles/maintainer.md")).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
    expect(resolve("rules/related-cap.rule.md")).toEqual({
      kind: "resolved",
      entity: cap,
      by: "path",
    });
  });

  it("resolves a path through the identifier it derives when the file was renamed by slugification", () => {
    expect(resolve("roles/theme.md")).toEqual({ kind: "resolved", entity: renamed, by: "path" });
    expect(resolve("Roles/Maintainer.md")).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
    expect(resolve("roles/nobody.md")).toEqual({ kind: "unresolved" });
  });

  it("resolves an exact title after trimming, case-sensitively", () => {
    expect(resolve("Related cap")).toEqual({ kind: "resolved", entity: cap, by: "title" });
    expect(resolve("  Related cap ")).toEqual({ kind: "resolved", entity: cap, by: "title" });
    expect(resolve("related cap")).toEqual({ kind: "unresolved" });
  });

  it("reports a title shared by several notes as ambiguous with every candidate, in identifier order whatever the order of the entities", () => {
    expect(resolve("Link")).toEqual({ kind: "ambiguous", candidates: [term, object] });
    const reversed = resolveReference("Link", {
      from: screen,
      index: indexEntities([renamed, term, object, cap, role, screen]),
    });
    expect(reversed).toEqual({ kind: "ambiguous", candidates: [term, object] });
  });

  it("tries the identifier before the path and the path before the title", () => {
    const identified = entity("specs/roles/maintainer.md", "role", "Named by frontmatter", {
      name: "specs",
      path: "roles/named.md",
    });
    const titled = entity("specs/roles/titled", "role", "roles/maintainer.md", {
      name: "specs",
      path: "roles/titled.md",
    });
    const context = { from: screen, index: indexEntities([screen, role, identified, titled]) };
    expect(resolveReference("roles/maintainer.md", context)).toEqual({
      kind: "resolved",
      entity: identified,
      by: "id",
    });
    const shadowed = { from: screen, index: indexEntities([screen, role, titled]) };
    expect(resolveReference("roles/maintainer.md", shadowed)).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
  });

  it("resolves nothing for a value without an extension that is neither an identifier nor a title", () => {
    expect(resolve("roles/maintainer.txt")).toEqual({ kind: "unresolved" });
    expect(resolve("")).toEqual({ kind: "unresolved" });
  });
});
