import type { Entity } from "../../../src/model/entity.js";
import type { Finding } from "../../../src/model/finding.js";
import type { Link } from "../../../src/model/link.js";
import type { AssembleModelInput } from "../../../src/model/serialize/assemble.js";

export function entity(id: string, overrides: Partial<Entity> = {}): Entity {
  const [name = "specs", ...rest] = id.split("/");
  return {
    id,
    type: "screen",
    title: rest.join("/"),
    aliases: [],
    locale: "en",
    application: "concordance-cli",
    domain: "inference",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: {},
    source: {
      name,
      path: `${rest.join("/")}.md`,
      line: 1,
      last_modified: "2026-03-01T00:00:00Z",
    },
    ...overrides,
  };
}

export function link(
  from: string,
  to: string,
  relation: string,
  overrides: Partial<Link> = {},
): Link {
  return {
    from,
    to,
    relation,
    confidence: 1,
    provenance: [{ method: "explicit_link", confidence: 1, path: `${from}.md`, line: 3 }],
    ...overrides,
  };
}

export function finding(check: string, overrides: Partial<Finding> = {}): Finding {
  return {
    check,
    severity: "warning",
    message: `${check} happened`,
    remediation: "Fix it.",
    ...overrides,
  };
}

/** A small, deliberately unsorted input: every block has at least two items out of order. */
export function sampleInput(): AssembleModelInput {
  const term = entity("glossary/entity", {
    type: "term",
    type_origin: "source",
    domain: "publication",
  });
  // A glossary term of no application: the optional fields must survive the round trip.
  delete term.application;
  return {
    version: "1.2.3",
    timestamp: "2026-09-12T12:00:00.000Z",
    profileFingerprint: "abc123",
    sources: [
      {
        name: "specs",
        commit: "0123456789abcdef0123456789abcdef01234567",
        url: "https://forge.example/specs.git",
      },
      { name: "glossary" },
    ],
    entities: [
      entity("specs/screens/entity-page", { attributes: { owner: "team-a", tags: ["b", "a"] } }),
      term,
    ],
    links: [
      link("specs/screens/entity-page", "glossary/entity", "related", {
        confidence: 0.7,
        attributes: { mode: "read" },
        provenance: [
          {
            method: "section_mention",
            confidence: 0.7,
            path: "screens/entity-page.md",
            line: 9,
            section: "Objects",
          },
          {
            method: "explicit_link",
            confidence: 1,
            path: "screens/entity-page.md",
            line: 12,
            text: "entity",
          },
          {
            method: "explicit_link",
            confidence: 1,
            path: "screens/entity-page.md",
            line: 4,
            text: "the entity",
          },
        ],
      }),
      link("glossary/entity", "specs/screens/entity-page", "related"),
    ],
    findings: [
      finding("W-STALE", { source: "specs", path: "screens/entity-page.md" }),
      finding("I-REL-AMBIGUOUS", {
        source: "specs",
        path: "screens/entity-page.md",
        line: 12,
        severity: "info",
      }),
    ],
  };
}
