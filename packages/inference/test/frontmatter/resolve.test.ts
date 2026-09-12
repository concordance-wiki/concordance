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

const screen = entity("specs/screens/entry", "screen", "Free payment entry", {
  name: "specs",
  path: "screens/entry.md",
});
const role = entity("specs/roles/account-manager", "role", "Account manager", {
  name: "specs",
  path: "roles/account-manager.md",
});
const cap = entity("specs/rules/annual-cap", "rule", "Annual cap", {
  name: "specs",
  path: "rules/annual-cap.rule.md",
});
const payment = entity("specs/objects/payment", "business_object", "Payment", {
  name: "specs",
  path: "objects/payment.md",
});
const term = entity("glossary/payment", "term", "Payment", {
  name: "glossary",
  path: "payment.md",
});
const renamed = entity("specs/roles/branch", "role", "Branch clerk", {
  name: "specs",
  path: "roles/Branch Clerk.md",
});

const index = indexEntities([screen, role, cap, payment, term, renamed]);

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
    expect([...built.byId.keys()]).toEqual(["specs/roles/clerk", "specs/roles/account-manager"]);
    expect([...built.byPath.keys()]).toEqual([
      "specs/roles/clerk.md",
      "specs/roles/account-manager.md",
    ]);
    expect([...built.byTitle.keys()]).toEqual(["Clerk", "Account manager"]);
  });

  it("keeps the first entity of a repeated identifier or path and every entity of a repeated title", () => {
    const twin = entity("specs/objects/payment", "term", "Payment", {
      name: "specs",
      path: "objects/payment.md",
    });
    const built = indexEntities([payment, twin, term]);
    expect(built.byId.get("specs/objects/payment")).toBe(payment);
    expect(built.byPath.get("specs/objects/payment.md")).toBe(payment);
    expect(built.byTitle.get("Payment")).toEqual([payment, twin, term]);
  });
});

describe("resolveReference", () => {
  it("resolves a full identifier", () => {
    expect(resolve("specs/roles/account-manager")).toEqual({
      kind: "resolved",
      entity: role,
      by: "id",
    });
  });

  it("resolves an identifier relative to the source of the referring note", () => {
    expect(resolve("roles/account-manager")).toEqual({ kind: "resolved", entity: role, by: "id" });
    expect(resolve("payment", term)).toEqual({ kind: "resolved", entity: term, by: "id" });
    expect(resolve("payment")).toEqual({ kind: "unresolved" });
  });

  it("resolves a source-relative path, type suffix and extension included", () => {
    expect(resolve("roles/account-manager.md")).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
    expect(resolve("rules/annual-cap.rule.md")).toEqual({
      kind: "resolved",
      entity: cap,
      by: "path",
    });
  });

  it("resolves a path through the identifier it derives when the file was renamed by slugification", () => {
    expect(resolve("roles/branch.md")).toEqual({ kind: "resolved", entity: renamed, by: "path" });
    expect(resolve("Roles/Account Manager.md")).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
    expect(resolve("roles/nobody.md")).toEqual({ kind: "unresolved" });
  });

  it("resolves an exact title after trimming, case-sensitively", () => {
    expect(resolve("Annual cap")).toEqual({ kind: "resolved", entity: cap, by: "title" });
    expect(resolve("  Annual cap ")).toEqual({ kind: "resolved", entity: cap, by: "title" });
    expect(resolve("annual cap")).toEqual({ kind: "unresolved" });
  });

  it("reports a title shared by several notes as ambiguous with every candidate", () => {
    expect(resolve("Payment")).toEqual({ kind: "ambiguous", candidates: [payment, term] });
  });

  it("tries the identifier before the path and the path before the title", () => {
    const identified = entity("specs/roles/account-manager.md", "role", "Named by frontmatter", {
      name: "specs",
      path: "roles/named.md",
    });
    const titled = entity("specs/roles/titled", "role", "roles/account-manager.md", {
      name: "specs",
      path: "roles/titled.md",
    });
    const context = { from: screen, index: indexEntities([screen, role, identified, titled]) };
    expect(resolveReference("roles/account-manager.md", context)).toEqual({
      kind: "resolved",
      entity: identified,
      by: "id",
    });
    const shadowed = { from: screen, index: indexEntities([screen, role, titled]) };
    expect(resolveReference("roles/account-manager.md", shadowed)).toEqual({
      kind: "resolved",
      entity: role,
      by: "path",
    });
  });

  it("resolves nothing for a value without an extension that is neither an identifier nor a title", () => {
    expect(resolve("roles/account-manager.txt")).toEqual({ kind: "unresolved" });
    expect(resolve("")).toEqual({ kind: "unresolved" });
  });
});
