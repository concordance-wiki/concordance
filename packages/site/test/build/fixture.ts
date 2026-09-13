import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CanonicalModel, Entity, Link } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";
import { parse } from "yaml";

import type { EntityFragment } from "../../src/build/fragments.js";
import type { SearchTokenizer } from "../../src/search/build.js";
import { normalizeQuery, trimEdges } from "../../src/search/shared.js";

// Read from the test file's own location, which stays a file URL under every test environment;
// the profile package validates this file in its own tests, so the parsed document is a Profile.
const defaultProfile = resolve(fileURLToPath(import.meta.url), "../../../../profile/default.yaml");

export const profile = parse(readFileSync(defaultProfile, "utf8")) as Profile;

/** Folds case and accents like the language packs, without their singular forms: enough for the site tests. */
export const tokenize: SearchTokenizer = (text) =>
  normalizeQuery(text)
    .split(" ")
    .map(trimEdges)
    .filter((word) => word.length >= 2);

export function entity(overrides: Partial<Entity> & Pick<Entity, "id" | "type" | "title">): Entity {
  const [source = "specs", ...rest] = overrides.id.split("/");
  return {
    aliases: [],
    locale: "en",
    status: "active",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: source, path: `${rest.join("/")}.md`, line: 1 },
    ...overrides,
  };
}

export const term: Entity = entity({
  id: "glossary/keyword-page",
  type: "term",
  title: "Keyword page",
  aliases: ["word page"],
  application: "concordance-cli",
  domain: "publication",
  attributes: { broader: "glossary/page", supersedes: "unknown/thing", note: true, weight: 3 },
  source: {
    name: "glossary",
    path: "keyword-page.md",
    line: 1,
    commit: "0123456789abcdef0123456789abcdef01234567",
  },
});

export const page: Entity = entity({
  id: "glossary/page",
  type: "term",
  title: "Page",
  application: "concordance-cli",
  domain: "publication",
});

export const screen: Entity = entity({
  id: "specs/screens/mentions-panel",
  type: "screen",
  title: "Mentions panel",
  application: "concordance-cli",
  domain: "publication",
  attributes: { roles: ["roles/reader"], url_pattern: "/{id}/", actions: [{ label: "sort" }] },
  representations: [
    { path: "screens/mentions-panel.md", format: "markdown" },
    { path: "screens/mentions-panel.pptx", format: "pptx" },
    { path: "listMentions", format: "json", kind: "contract", operation: "listMentions" },
  ],
});

export const rule: Entity = entity({
  id: "specs/rules/publication-threshold",
  type: "rule",
  title: "Épreuve du seuil",
  locale: "fr",
  domain: "inference/recognition",
  status: "planned",
  attributes: { severity: "error" },
});

export const untyped: Entity = entity({
  id: "framing/vision",
  type: "document",
  title: "vision",
  type_origin: "default",
});

export const keyword: Entity = entity({
  id: "keywords/build-summary",
  type: "term",
  title: "build summary",
  status: "valid",
  type_origin: "default",
  attributes: { documents: 2, occurrences: 5, score: 12.5 },
  source: { name: "specs", path: "screens/mentions-panel.md", line: 12 },
  keyword: true,
});

export const orphanKeyword: Entity = entity({
  id: "keywords/zzz",
  type: "term",
  title: "#hash",
  status: "valid",
  type_origin: "default",
  attributes: {},
  source: { name: "specs", path: "nowhere.md", line: 1 },
  keyword: true,
});

export const links: Link[] = [
  {
    from: "specs/screens/mentions-panel",
    to: "glossary/keyword-page",
    relation: "displays",
    confidence: 1,
    provenance: [
      {
        method: "explicit_link",
        confidence: 1,
        path: "screens/mentions-panel.md",
        line: 7,
        text: "keyword pages",
      },
      {
        method: "glossary_occurrence",
        confidence: 0.6,
        path: "screens/mentions-panel.md",
        line: 15,
        occurrences: [
          {
            line: 15,
            position: 8,
            context: "…lists the keyword pages that cite the entity, grouped by file…",
          },
        ],
      },
      {
        method: "glossary_occurrence",
        confidence: 0.6,
        path: "screens/mentions-panel.md",
        line: 9,
      },
      { method: "cooccurrence", confidence: 0.3, count: 2 },
    ],
  },
  {
    from: "glossary/page",
    to: "glossary/keyword-page",
    relation: "related",
    confidence: 0.7,
    provenance: [
      {
        method: "section_mention",
        confidence: 0.7,
        path: "page.md",
        line: 5,
        section: "See also",
      },
    ],
  },
  {
    from: "specs/rules/publication-threshold",
    to: "glossary/keyword-page",
    relation: "applies_to",
    confidence: 0.8,
    provenance: [
      {
        method: "frontmatter_ref",
        confidence: 0.8,
        path: "rules/publication-threshold.md",
        attribute: "applies_to",
      },
    ],
  },
  {
    from: "unknown/ghost",
    to: "glossary/keyword-page",
    relation: "related",
    confidence: 0.5,
    provenance: [{ method: "explicit_link", confidence: 0.5, path: "ghost.md", line: 1 }],
  },
  {
    from: "glossary/page",
    to: "framing/vision",
    relation: "related",
    confidence: 0.5,
    provenance: [
      { method: "explicit_link", confidence: 0.5, path: "page.md", line: 9, text: "vision" },
    ],
  },
  {
    from: "glossary/keyword-page",
    to: "glossary/page",
    relation: "broader",
    confidence: 0.9,
    provenance: [
      {
        method: "frontmatter_ref",
        confidence: 0.9,
        path: "keyword-page.md",
        line: 2,
        attribute: "broader",
      },
    ],
  },
];

export function model(overrides: Partial<CanonicalModel> = {}): CanonicalModel {
  return {
    version: 1,
    build: {
      tool: "0.1.0",
      at: "2026-09-12T12:00:00.000Z",
      profile_hash: "abc",
      sources: [
        { name: "glossary", files: 2 },
        { name: "specs", files: 3, commit: "0123456789abcdef0123456789abcdef01234567" },
        { name: "framing" },
      ],
    },
    entities: [untyped, term, page, keyword, orphanKeyword, rule, screen],
    links,
    findings: [
      {
        check: "W-TERM-UNDEFINED",
        severity: "warning",
        message: "build summary has no note",
        remediation: "Write one.",
        entity: "keywords/build-summary",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "vision has no markdown representation",
        remediation: "Write one.",
        entity: "framing/vision",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "the deck has no markdown representation",
        remediation: "Write one.",
        entity: "framing/vision",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "the deck of the screen has no markdown representation",
        remediation: "Write one.",
        entity: "specs/screens/mentions-panel",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "the page has no markdown representation",
        remediation: "Write one.",
        entity: "glossary/page",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "a finding without entity",
        remediation: "Nothing.",
      },
      {
        check: "W-DOC-NOMD",
        severity: "warning",
        message: "a finding on an entity the model lost",
        remediation: "Nothing.",
        entity: "unknown/ghost",
      },
    ],
    candidates: { terms: [], duplicates: [] },
    neighbours: {
      "glossary/keyword-page": [
        { id: "specs/screens/mentions-panel", count: 4 },
        { id: "glossary/page", count: 2 },
      ],
      "keywords/build-summary": [
        { id: "specs/screens/mentions-panel", count: 6 },
        { id: "glossary/keyword-page", count: 3 },
        { id: "unknown/ghost", count: 1 },
      ],
    },
    displayed_neighbourhood: {
      "specs/screens/mentions-panel": [
        {
          id: "glossary/keyword-page",
          title: "Keyword page",
          type: "term",
          kind: "entity",
          relation: "displays",
          direction: "out",
          confidence: 1,
          rank: 0,
        },
      ],
      "glossary/keyword-page": [
        {
          id: "glossary/page",
          title: "Page",
          type: "term",
          kind: "entity",
          relation: "broader",
          direction: "out",
          confidence: 0.9,
          rank: 0,
        },
        {
          id: "specs/screens/mentions-panel",
          title: "Mentions panel",
          type: "screen",
          kind: "entity",
          relation: "displays",
          direction: "in",
          confidence: 1,
          rank: 2,
        },
        {
          id: "keywords/build-summary",
          title: "build summary",
          type: "term",
          kind: "keyword",
          relation: "unknown_relation",
          direction: "both",
          confidence: 0.3,
          rank: 4,
        },
      ],
    },
    ...overrides,
  };
}

export const fragments = new Map<string, EntityFragment>([
  [
    "glossary/keyword-page",
    {
      id: "glossary/keyword-page",
      sections: [
        {
          id: "section-lead",
          html: '<p>A <a href="../page/index.html">page</a> built for every word above the threshold.</p>',
        },
        {
          id: "section-not-to-be-confused-with",
          heading: "Not to be confused with",
          html: "<p>An entity page.</p>",
        },
      ],
      text: "A page built for every word above the threshold.\nNot to be confused with\nAn entity page.",
    },
  ],
  [
    "keywords/build-summary",
    {
      id: "keywords/build-summary",
      sections: [],
      passages: [
        { source: "glossary", path: "page.md", line: 3, context: "the build summary is printed" },
        {
          source: "specs",
          path: "screens/mentions-panel.md",
          line: 12,
          context: "after the build summary",
        },
        {
          source: "specs",
          path: "screens/mentions-panel.md",
          line: 40,
          context: "the build summary again",
        },
        { source: "specs", path: "unknown.md", line: 1, context: "a file that is no page" },
      ],
    },
  ],
]);
