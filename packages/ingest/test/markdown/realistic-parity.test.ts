import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import { nodeFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { parseMarkdown } from "../../src/index.js";
import type { ParsedMarkdown } from "../../src/markdown/types.js";

const corpora = fileURLToPath(new URL("../../../../fixtures/corpora/realistic/", import.meta.url));

// French source folders of the corpus, mapped to their English counterpart.
const sources: Readonly<Record<string, string>> = {
  glossaire: "glossary",
  specs: "specs",
  decisions: "decisions",
  reunions: "meetings",
  cadrage: "framing",
};

// French headings of the corpus, mapped to their English counterpart.
const headings: Readonly<Record<string, string>> = {
  Objets: "Objects",
  Actions: "Actions",
  Règles: "Rules",
  Étapes: "Steps",
  Lit: "Reads",
  Écrit: "Writes",
  "S'applique à": "Applies to",
  Affecte: "Affects",
  Consommateurs: "Consumers",
  "À ne pas confondre avec": "Not to be confused with",
};

// French application and domain identifiers, mapped to their English counterpart.
const containers: Readonly<Record<string, string>> = {
  "concordance-cli": "concordance-cli",
  "concordance-service": "concordance-service",
  ingestion: "ingestion",
  inference: "inference",
  reconnaissance: "recognition",
  "inference/reconnaissance": "inference/recognition",
  publication: "publication",
  qualite: "quality",
  unclassified: "unclassified",
};

interface CorpusNote {
  source: string;
  path: string;
  document: ParsedMarkdown;
}

interface ExpectedEntity {
  type: string;
  type_origin: string;
  application: string | null;
  domain: string;
}

interface ExpectedLink {
  relation: string;
  method: string;
  min_confidence: number;
  inverse?: boolean;
  attributes?: Record<string, string>;
}

interface ExpectedKeywords {
  published: { text: string }[];
  unpublished: { text: string }[];
}

function translate(table: Readonly<Record<string, string>>, value: string): string {
  const english = table[value];
  expect(english, `no translation for "${value}"`).toBeDefined();
  return english ?? value;
}

function listCorpus(locale: string): string[] {
  return nodeFileSystem
    .listFiles(posix.join(corpora, locale))
    .filter((path) => !path.startsWith("expected/") && path !== "concordance.yaml");
}

function readCorpus(locale: string, sourceOf: (folder: string) => string): CorpusNote[] {
  const root = posix.join(corpora, locale);
  return listCorpus(locale)
    .filter((path) => path.endsWith(".md"))
    .map((path) => {
      const [folder, ...rest] = path.split("/");
      return {
        source: sourceOf(folder ?? ""),
        path: rest.join("/"),
        document: parseMarkdown(nodeFileSystem.readText(posix.join(root, path)), { path }),
      };
    });
}

function countBySource(locale: string, sourceOf: (folder: string) => string): string[] {
  const counts = new Map<string, number>();
  for (const path of listCorpus(locale)) {
    const key = `${sourceOf(path.split("/")[0] ?? "")} ${path.endsWith(".md") ? "markdown" : "other"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => `${key}: ${String(count)}`).sort();
}

function sectionHeadings(
  notes: CorpusNote[],
  translateHeading: (heading: string) => string,
): string[] {
  return notes
    .flatMap((note) =>
      note.document.sections.map(
        (section) => `${note.source} ${translateHeading(section.heading)}`,
      ),
    )
    .sort();
}

// File names are translated too, so the notes are compared as a multiset per source rather than in listing order.
function frontmatterKeySets(notes: CorpusNote[]): string[] {
  return notes
    .map((note) => `${note.source} ${Object.keys(note.document.frontmatter).sort().join(",")}`)
    .sort();
}

/** The fixtures are reviewed by hand and validated by the repository scripts; the caller names their shape. */
function readExpected(locale: string, name: string): unknown {
  return parse(nodeFileSystem.readText(posix.join(corpora, locale, "expected", name)));
}
const asEntities = (value: unknown): ExpectedEntity[] =>
  // Reviewed fixture: a list of entity records.
  value as ExpectedEntity[];
const asLinks = (value: unknown): ExpectedLink[] =>
  // Reviewed fixture: a list of link records.
  value as ExpectedLink[];
const asFindings = (value: unknown): { check: string }[] =>
  // Reviewed fixture: a list of finding records.
  value as { check: string }[];
const asKeywords = (value: unknown): ExpectedKeywords =>
  // Reviewed fixture: published and unpublished lists.
  value as ExpectedKeywords;

const identity = (value: string): string => value;
const en = readCorpus("en", identity);
const fr = readCorpus("fr", (folder) => translate(sources, folder));

describe("the realistic corpus has the same structure in both languages", () => {
  it("has the same number of markdown and other files per source", () => {
    const english = countBySource("en", identity);
    expect(countBySource("fr", (folder) => translate(sources, folder))).toEqual(english);
    expect(english).toEqual([
      "decisions markdown: 7",
      "framing markdown: 5",
      "glossary markdown: 45",
      "meetings markdown: 6",
      "specs markdown: 57",
      "specs other: 2",
    ]);
  });

  it("has the same frontmatter key sets note for note within each source", () => {
    expect(frontmatterKeySets(fr)).toEqual(frontmatterKeySets(en));
  });

  it("has the same section headings once translated", () => {
    const translated = sectionHeadings(fr, (heading) => translate(headings, heading));
    expect(translated).toEqual(sectionHeadings(en, identity));
    expect(translated).toHaveLength(68);
  });

  it("gives every note a title and a valid frontmatter", () => {
    for (const note of [...en, ...fr]) {
      expect(note.document.title, note.path).toBeDefined();
      expect(note.document.findings, note.path).toEqual([]);
    }
  });

  it("names meeting participants by pseudonym only", () => {
    const meetings = [...en, ...fr].filter((note) => note.source === "meetings");
    expect(meetings).toHaveLength(12);
    for (const note of meetings) {
      const { participants } = note.document.frontmatter;
      expect(Array.isArray(participants), note.path).toBe(true);
      if (Array.isArray(participants)) {
        expect(participants.length, note.path).toBeGreaterThan(0);
        for (const participant of participants) {
          expect(participant, note.path).toMatch(/^Participant-\d+$/);
        }
      }
    }
  });
});

describe("the expected results of the realistic corpus have the same structure in both languages", () => {
  it("lists the same entity types, origins, applications and domains", () => {
    const shape = (entities: ExpectedEntity[], container: (id: string) => string): string[] =>
      entities
        .map(
          (entity) =>
            `${entity.type} ${entity.type_origin} ${entity.application === null ? "none" : container(entity.application)} ${container(entity.domain)}`,
        )
        .sort();
    const english = shape(asEntities(readExpected("en", "entities.yaml")), identity);
    expect(
      shape(asEntities(readExpected("fr", "entities.yaml")), (id) => translate(containers, id)),
    ).toEqual(english);
    expect(english).toHaveLength(119);
  });

  it("lists the same links by relation, method, direction, attributes and confidence", () => {
    const shape = (links: ExpectedLink[]): string[] =>
      links
        .map(
          (link) =>
            `${link.relation} ${link.method} ${String(link.min_confidence)} ${link.inverse === true ? "inverse" : "direct"} ${JSON.stringify(link.attributes ?? {})}`,
        )
        .sort();
    const english = shape(asLinks(readExpected("en", "links.yaml")));
    expect(shape(asLinks(readExpected("fr", "links.yaml")))).toEqual(english);
    expect(english).toHaveLength(60);
    expect(new Set(asLinks(readExpected("en", "links.yaml")).map((link) => link.method))).toEqual(
      new Set([
        "explicit_link",
        "contract_import",
        "frontmatter_ref",
        "folder_zone",
        "section_mention",
        "glossary_occurrence",
        "cooccurrence",
      ]),
    );
  });

  it("lists the same findings by check", () => {
    const checks = (locale: string): string[] =>
      asFindings(readExpected(locale, "findings.yaml"))
        .map((finding) => finding.check)
        .sort();
    const english = checks("en");
    expect(checks("fr")).toEqual(english);
    expect([...new Set(english)]).toEqual([
      "I-REL-AMBIGUOUS",
      "W-API-CONSUMER-MISMATCH",
      "W-API-NOCONSUMER",
      "W-APP-MISSING",
      "W-ATTRIBUTE-UNKNOWN",
      "W-DOMAIN-UNCLASSIFIED",
      "W-TERM-UNDEFINED",
      "W-TERM-UNUSED",
    ]);
  });

  it("lists the same number of published and unpublished keywords", () => {
    const english = asKeywords(readExpected("en", "keywords.yaml"));
    const french = asKeywords(readExpected("fr", "keywords.yaml"));
    expect([french.published.length, french.unpublished.length]).toEqual([
      english.published.length,
      english.unpublished.length,
    ]);
    expect(english.published).toHaveLength(1);
  });
});
