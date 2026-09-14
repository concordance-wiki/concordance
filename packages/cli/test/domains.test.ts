import { createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  memoryFileSystem,
  parseConfig,
  type BuildLog,
  type Entity,
  type Finding,
  type Link,
  type LockFile,
  type PluginRegistry,
} from "@concordance-wiki/core";
import type { Neighbourhood } from "@concordance-wiki/inference";
import { ingestSources } from "@concordance-wiki/ingest";
import { buildDictionary } from "@concordance-wiki/nlp";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../src/commands/build.js";
import type { LocaleDictionary } from "../src/pipeline/dictionary.js";
import {
  DOMAIN_SUGGESTED_CHECK,
  domainNamedAfter,
  domainOfPivot,
  proposeDomains,
  withoutAnswered,
  type ProposeDomainsInput,
} from "../src/pipeline/domains.js";
import { runPipeline, type PipelineResult } from "../src/pipeline/run.js";
import { FakeGit, recordedIo } from "./helpers.js";

const profile = loadDefaultProfile();
const clock = fixedClock("2026-09-12T12:00:00Z");

function entity(id: string, overrides: Partial<Entity> = {}): Entity {
  const [source, ...rest] = id.split("/");
  return {
    id,
    type: source === "glossary" ? "term" : "screen",
    title: rest.join(" ").replaceAll("-", " "),
    aliases: [],
    locale: "en",
    domain: "unclassified",
    domain_origin: "unclassified",
    status: "draft",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: source ?? "", path: `${rest.join("/")}.md`, line: 1 },
    ...overrides,
  };
}

/** A keyword page: a term without a note of its own, filed nowhere. */
function keywordPage(id: string): Entity {
  const page = entity(id, { type: "term", keyword: true });
  delete page.domain;
  delete page.domain_origin;
  return page;
}

function link(from: string, to: string): Link {
  return {
    from,
    to,
    relation: "related",
    confidence: 0.6,
    provenance: [{ method: "glossary_occurrence", confidence: 0.6 }],
  };
}

function neighbourhood(pairs: readonly [string, string][]): Neighbourhood {
  const nodes = new Map<string, { id: string; count: number }[]>();
  for (const [a, b] of pairs) {
    nodes.set(a, [...(nodes.get(a) ?? []), { id: b, count: 1 }]);
    nodes.set(b, [...(nodes.get(b) ?? []), { id: a, count: 1 }]);
  }
  return { k: 50, nodes };
}

function dictionaries(stopwords: readonly string[] = []): Map<string, LocaleDictionary> {
  const words = new Set(stopwords);
  return new Map([
    [
      "en",
      {
        dictionary: buildDictionary({
          entities: [],
          locale: "en",
          glossarySources: new Set(),
          stopwords: words,
          shortTerms: new Set(),
        }),
        stopwords: words,
      },
    ],
  ]);
}

function configWith(inference: string): ProposeDomainsInput["config"] {
  const parsed = parseConfig(
    `version: 1\nproject: { name: Concordance wiki }\nsources: [{ name: glossary, path: ./glossary }]\n${inference}`,
  );
  if (!parsed.ok) throw new Error("invalid configuration");
  return parsed.config;
}

/**
 * The check term is cited by three screens and the finding term by one; the finding also cites
 * the check. The linter screen and the linter term are filed, the "the" term is a stopword.
 */
const entities = [
  entity("glossary/check"),
  entity("glossary/finding"),
  entity("glossary/the", { title: "The" }),
  entity("specs/todo-page"),
  entity("specs/lint-report"),
  entity("specs/linter", { domain: "quality", domain_origin: "glob" }),
  entity("glossary/linter", { domain: "quality", domain_origin: "glob" }),
  entity("specs/home", { domain: "publication", domain_origin: "frontmatter" }),
  keywordPage("keywords/build-summary"),
];
const links = [
  link("specs/todo-page", "glossary/check"),
  link("specs/lint-report", "glossary/check"),
  link("specs/linter", "glossary/check"),
  link("glossary/finding", "glossary/check"),
  link("glossary/the", "specs/todo-page"),
  link("glossary/the", "specs/lint-report"),
  link("glossary/the", "specs/linter"),
  link("keywords/build-summary", "specs/home"),
  link("specs/linter", "glossary/linter"),
];
const cooccurrences = neighbourhood([
  ["glossary/finding", "specs/lint-report"],
  ["specs/home", "specs/todo-page"],
]);

function propose(inference: string, lock?: LockFile) {
  return proposeDomains({
    entities,
    links,
    neighbourhood: cooccurrences,
    config: configWith(inference),
    dictionaries: dictionaries(["the"]),
    ...(lock === undefined ? {} : { lock }),
  });
}

const messagesOf = (findings: readonly Finding[]): string[] =>
  findings.map((finding) => finding.message);

describe("proposeDomains", () => {
  it("names a domain after the last segment of the pivot's identifier", () => {
    expect(domainNamedAfter("glossary/check")).toBe("check");
    expect(domainNamedAfter("glossary/inference/co-occurrence")).toBe("co-occurrence");
  });

  it("proposes the pivot's own domain when something files the pivot, and one named after it otherwise", () => {
    // The linter term is filed under quality by a glob and cited by the linter screen and the check term.
    // A lint summary screen cites the linter term alone: the linter is its only pivot.
    const result = proposeDomains({
      entities: [...entities, entity("specs/lint-summary")],
      links: [
        ...links,
        link("glossary/check", "glossary/linter"),
        link("specs/lint-summary", "glossary/linter"),
      ],
      neighbourhood: cooccurrences,
      config: configWith("inference: { domains: { min_neighbours: 3, radius: 1, assign: true } }"),
      dictionaries: dictionaries(["the"]),
    });
    const linter = result.findings.filter((finding) =>
      finding.message.includes("glossary/linter ("),
    );
    expect(linter.map((finding) => finding.message)).toEqual([
      'specs/lint-summary lies within 1 of glossary/linter (degree 3): a candidate for its domain "quality"',
    ]);
    expect(result.suggested?.find((row) => row.pivot === "glossary/linter")?.domain).toBe(
      "quality",
    );
    expect(result.entities.find((entity) => entity.id === "specs/lint-summary")).toMatchObject({
      domain: "quality",
      domain_origin: "inferred",
    });
    expect(domainOfPivot(entity("glossary/check"))).toEqual({ domain: "check", own: false });
    const bare = entity("glossary/check");
    delete bare.domain;
    expect(domainOfPivot(bare)).toEqual({ domain: "check", own: false });
  });

  it("proposes nothing and files nothing while inference.domains is unset", () => {
    const result = propose("");
    expect(result).toEqual({ entities, findings: [], filed: new Set() });
    expect(result.entities).not.toBe(entities);
  });

  it("reports every unclassified note a pivot reaches, the pivot itself at distance zero, and lists the pivots that reach one", () => {
    const result = propose("inference: { domains: { min_neighbours: 3, radius: 1 } }");
    expect(result.findings).toEqual([
      {
        check: DOMAIN_SUGGESTED_CHECK,
        severity: "info",
        source: "glossary",
        path: "check.md",
        entity: "glossary/check",
        message:
          'glossary/check is a pivot of degree 4: a candidate for a domain named "check" after it',
        remediation:
          "Declare the domain under domains in concordance.yaml with a folder or a glob that claims the note, or record the note under domains in the lock file; inference.domains.assign files every reached note without a decision.",
      },
      expect.objectContaining({
        entity: "glossary/finding",
        message:
          'glossary/finding lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
      }),
      expect.objectContaining({
        entity: "specs/lint-report",
        source: "specs",
        path: "lint-report.md",
        message:
          'specs/lint-report lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
      }),
      expect.objectContaining({ entity: "specs/todo-page" }),
    ]);
    expect(result.suggested).toEqual([
      {
        pivot: "glossary/check",
        degree: 4,
        domain: "check",
        notes: ["glossary/check", "glossary/finding", "specs/lint-report", "specs/todo-page"],
      },
    ]);
    expect(result.entities).toEqual(entities);
    expect(result.filed).toEqual(new Set());
  });

  it("never pivots on a stopword, a keyword page or a note of another type, and lists no pivot that reaches nothing", () => {
    const result = propose("inference: { domains: { min_neighbours: 1, radius: 1 } }");
    expect(result.suggested?.map((domain) => domain.pivot)).toEqual([
      "glossary/check",
      "glossary/finding",
    ]);
    expect(result.findings.map((finding) => finding.entity)).not.toContain("glossary/linter");
    const unfiltered = proposeDomains({
      entities,
      links,
      neighbourhood: cooccurrences,
      config: configWith("inference: { domains: { min_neighbours: 3, radius: 1 } }"),
      dictionaries: dictionaries(),
    });
    expect(unfiltered.suggested?.map((domain) => domain.pivot)).toEqual([
      "glossary/check",
      "glossary/the",
    ]);
  });

  it("never pivots on a term the lock rejects, compared on its normalised form, nor on a title made of stopwords only", () => {
    const rejected = propose("inference: { domains: { min_neighbours: 3, radius: 1 } }", {
      version: 1,
      rejected_terms: ["Checks"],
    });
    expect(rejected.suggested).toEqual([]);
    expect(rejected.findings).toEqual([]);
    const made = proposeDomains({
      entities: [...entities, entity("glossary/the-the", { title: "the the" })],
      links: [...links, link("glossary/the-the", "specs/todo-page")],
      neighbourhood: cooccurrences,
      config: configWith("inference: { domains: { min_neighbours: 1, radius: 1 } }"),
      dictionaries: dictionaries(["the"]),
    });
    expect(made.suggested?.map((domain) => domain.pivot)).not.toContain("glossary/the-the");
  });

  it("pivots on a term of a locale the corpus has no dictionary for, nothing excluding it", () => {
    const result = proposeDomains({
      entities: [...entities, entity("glossary/le", { title: "Le", locale: "fr" })],
      links: [...links, link("glossary/le", "specs/todo-page")],
      neighbourhood: cooccurrences,
      config: configWith("inference: { domains: { min_neighbours: 1, radius: 1 } }"),
      dictionaries: dictionaries(["the", "le"]),
    });
    expect(result.suggested?.map((domain) => domain.pivot)).toContain("glossary/le");
  });

  it("reaches through the filed notes and attaches a stopword note without ever touching a declared domain", () => {
    const result = propose("inference: { domains: { min_neighbours: 4, radius: 2 } }");
    expect(messagesOf(result.findings)).toEqual([
      'glossary/check is a pivot of degree 4: a candidate for a domain named "check" after it',
      'glossary/finding lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
      'glossary/the lies within 2 of glossary/check (degree 4): a candidate for a domain named "check" after it',
      'specs/lint-report lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
      'specs/todo-page lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
    ]);
    const further = propose("inference: { domains: { min_neighbours: 4, radius: 3 } }");
    expect(further.findings.map((finding) => finding.entity)).toEqual([
      "glossary/check",
      "glossary/finding",
      "glossary/the",
      "specs/lint-report",
      "specs/todo-page",
    ]);
    expect(further.entities.find((candidate) => candidate.id === "specs/home")).toEqual(
      entity("specs/home", { domain: "publication", domain_origin: "frontmatter" }),
    );
  });

  it("files the reached notes under the domain named after their pivot with assign, the origin inferred", () => {
    const result = propose(
      "inference: { domains: { min_neighbours: 3, radius: 1, assign: true } }",
    );
    expect(result.filed).toEqual(
      new Set(["glossary/check", "glossary/finding", "specs/lint-report", "specs/todo-page"]),
    );
    expect(
      result.entities.map(({ id, domain, domain_origin }) => [id, domain, domain_origin]),
    ).toEqual([
      ["glossary/check", "check", "inferred"],
      ["glossary/finding", "check", "inferred"],
      ["glossary/the", "unclassified", "unclassified"],
      ["specs/todo-page", "check", "inferred"],
      ["specs/lint-report", "check", "inferred"],
      ["specs/linter", "quality", "glob"],
      ["glossary/linter", "quality", "glob"],
      ["specs/home", "publication", "frontmatter"],
      ["keywords/build-summary", undefined, undefined],
    ]);
    expect(result.findings).toHaveLength(4);
  });

  it("files a note the lock promotes before proposing, with the origin lock, and leaves a declared domain alone", () => {
    const lock: LockFile = {
      version: 1,
      domains: {
        "specs/todo-page": "quality",
        "specs/linter": "publication",
        "specs/missing": "quality",
      },
    };
    const result = propose("inference: { domains: { min_neighbours: 3, radius: 1 } }", lock);
    expect(result.filed).toEqual(new Set(["specs/todo-page"]));
    expect(result.entities.find((candidate) => candidate.id === "specs/todo-page")).toEqual(
      entity("specs/todo-page", { domain: "quality", domain_origin: "lock" }),
    );
    expect(result.entities.find((candidate) => candidate.id === "specs/linter")).toEqual(
      entity("specs/linter", { domain: "quality", domain_origin: "glob" }),
    );
    expect(result.findings.map((finding) => finding.entity)).toEqual([
      "glossary/check",
      "glossary/finding",
      "specs/lint-report",
    ]);
    expect(propose("", lock).filed).toEqual(new Set(["specs/todo-page"]));
  });
});

describe("withoutAnswered", () => {
  const unclassified = (entityId: string | undefined): Finding => ({
    check: "W-DOMAIN-UNCLASSIFIED",
    severity: "info",
    message: "matches no declared domain",
    remediation: "file it",
    ...(entityId === undefined ? {} : { entity: entityId }),
  });
  const missing: Finding = {
    check: "W-APP-MISSING",
    severity: "warning",
    message: "no application",
    remediation: "set one",
    entity: "specs/todo-page",
  };

  it("drops the unclassified finding of every filed note and nothing else", () => {
    const findings = [
      unclassified("specs/todo-page"),
      unclassified("specs/home"),
      unclassified(undefined),
      missing,
    ];
    expect(withoutAnswered(findings, new Set(["specs/todo-page"]))).toEqual([
      unclassified("specs/home"),
      unclassified(undefined),
      missing,
    ]);
    expect(withoutAnswered(findings, new Set())).toEqual(findings);
  });
});

const noPlugins: PluginRegistry = {
  plugins: () => [],
  registrations: () => [],
  readers: () => [],
  converters: () => [],
  sources: () => [],
  inferenceMethods: () => [],
  checks: () => [],
  projections: () => [],
  uiComponents: () => [],
  themes: () => [],
  types: () => [],
};

/**
 * Three glossary terms and three screens; the check term is cited by every screen and by the
 * finding term, the finding term by two screens, the linter screen alone is filed by the
 * domain glob. From four neighbours the check is the only pivot.
 */
const corpus: Record<string, string> = {
  "/work/glossary/check.md": "# Check\n\nA rule the model is read with; it reports findings.\n",
  "/work/glossary/finding.md": "# Finding\n\nWhat a check reports about the corpus.\n",
  "/work/glossary/cue.md": "# Cue\n\nOne timed line of a transcript.\n",
  "/work/specs/screens/todo-page.md":
    "# To-do page\n\nLists every finding of every check with its remediation.\n",
  "/work/specs/screens/lint-report.md":
    "# Lint report\n\nThe findings of the check run in a merge request.\n",
  "/work/specs/screens/linter.md": "# Linter\n\nRuns every check on one repository.\n",
};

function configText(inference: string, lock = false): string {
  return [
    "version: 1",
    "project: { name: Concordance wiki }",
    "applications: [{ id: concordance-cli }]",
    "domains: [{ id: quality, match: ['**/linter*'] }]",
    "sources:",
    "  - { name: glossary, path: ./glossary, type: term, glossary: true, application: concordance-cli }",
    "  - { name: specs, path: ./specs, application: concordance-cli, rules: [{ match: { path: 'screens/**' }, set: { type: screen } }] }",
    `inference: { cross_source_links: true${inference} }`,
    ...(lock ? ["lock: ./concordance.lock.yaml"] : []),
    "",
  ].join("\n");
}

async function pipeline(inference: string, lock?: LockFile): Promise<PipelineResult> {
  const config = configText(inference);
  const fs = memoryFileSystem({ "/work/concordance.yaml": config, ...corpus });
  const parsed = parseConfig(config);
  if (!parsed.ok) throw new Error("invalid configuration");
  const ingested = await ingestSources(parsed.config, {
    fs,
    git: new FakeGit(fs),
    configDirectory: "/work",
    cacheDirectory: "/work/.concordance-cache",
  });
  return runPipeline({
    config: parsed.config,
    profile,
    configDirectory: "/work",
    cacheDirectory: "/work/.concordance-cache",
    sources: ingested.sources,
    findings: ingested.findings,
    plugins: noPlugins,
    checks: createRegistry(),
    fs,
    clock,
    ...(lock === undefined ? {} : { lock }),
  });
}

const domainsOf = (result: PipelineResult): [string, string | undefined, string | undefined][] =>
  result.entities.map(({ id, domain, domain_origin }) => [id, domain, domain_origin]);

describe("The proposal runs after the twins and before the model checks, and reaches the model and the build log", () => {
  it("proposes nothing without inference.domains and files nothing", async () => {
    const result = await pipeline("");
    expect(result.suggestedDomains).toBeUndefined();
    expect(result.findings.filter((finding) => finding.check === DOMAIN_SUGGESTED_CHECK)).toEqual(
      [],
    );
    expect(domainsOf(result)).toEqual([
      ["glossary/check", "unclassified", "unclassified"],
      ["glossary/cue", "unclassified", "unclassified"],
      ["glossary/finding", "unclassified", "unclassified"],
      ["specs/screens/lint-report", "unclassified", "unclassified"],
      ["specs/screens/linter", "quality", "glob"],
      ["specs/screens/todo-page", "unclassified", "unclassified"],
    ]);
  });

  it("reports the notes within the radius of the check term and keeps their unclassified findings", async () => {
    const result = await pipeline(", domains: { min_neighbours: 4, radius: 1 }");
    expect(result.suggestedDomains).toEqual([
      {
        pivot: "glossary/check",
        degree: 4,
        domain: "check",
        notes: [
          "glossary/check",
          "glossary/finding",
          "specs/screens/lint-report",
          "specs/screens/todo-page",
        ],
      },
    ]);
    expect(
      result.findings
        .filter((finding) => finding.check === DOMAIN_SUGGESTED_CHECK)
        .map((finding) => finding.entity),
    ).toEqual([
      "glossary/check",
      "glossary/finding",
      "specs/screens/lint-report",
      "specs/screens/todo-page",
    ]);
    expect(
      result.findings
        .filter((finding) => finding.check === "W-DOMAIN-UNCLASSIFIED")
        .map((finding) => finding.entity),
    ).toEqual([
      "glossary/check",
      "glossary/cue",
      "glossary/finding",
      "specs/screens/lint-report",
      "specs/screens/todo-page",
    ]);
  });

  it("files the reached notes with assign and answers their unclassified findings, the cue left as it is", async () => {
    const result = await pipeline(", domains: { min_neighbours: 4, radius: 1, assign: true }");
    expect(domainsOf(result)).toEqual([
      ["glossary/check", "check", "inferred"],
      ["glossary/cue", "unclassified", "unclassified"],
      ["glossary/finding", "check", "inferred"],
      ["specs/screens/lint-report", "check", "inferred"],
      ["specs/screens/linter", "quality", "glob"],
      ["specs/screens/todo-page", "check", "inferred"],
    ]);
    expect(
      result.findings
        .filter((finding) => finding.check === "W-DOMAIN-UNCLASSIFIED")
        .map((finding) => finding.entity),
    ).toEqual(["glossary/cue"]);
  });

  it("files a note the lock promotes, which the proposal then leaves aside", async () => {
    const result = await pipeline(", domains: { min_neighbours: 4, radius: 1 }", {
      version: 1,
      domains: { "specs/screens/todo-page": "quality", "specs/screens/linter": "publication" },
    });
    expect(domainsOf(result)).toContainEqual(["specs/screens/todo-page", "quality", "lock"]);
    expect(domainsOf(result)).toContainEqual(["specs/screens/linter", "quality", "glob"]);
    expect(result.suggestedDomains?.[0]?.notes).toEqual([
      "glossary/check",
      "glossary/finding",
      "specs/screens/lint-report",
    ]);
    expect(
      result.findings.filter(
        (finding) =>
          finding.entity === "specs/screens/todo-page" &&
          (finding.check === "W-DOMAIN-UNCLASSIFIED" || finding.check === DOMAIN_SUGGESTED_CHECK),
      ),
    ).toEqual([]);
  });
});

describe("concordance build writes the suggested domains in the summary and the log", () => {
  it("lists every pivot that reaches a note, with its degree and the notes, and counts the promoted domains of the lock", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": configText(", domains: { min_neighbours: 4, radius: 1 }", true),
      "/work/concordance.lock.yaml": "version: 1\ndomains:\n  specs/screens/todo-page: quality\n",
      ...corpus,
    });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.stdout).toContain(
      "lock decisions applied: rejected_terms 0, merged 0, separated 0, domains 1",
    );
    expect(io.stdout).toContain("suggested domains: 1");
    expect(io.stdout).toContain(
      "  glossary/check (degree 4): 3 note(s): glossary/check, glossary/finding, specs/screens/lint-report",
    );
    const log = JSON.parse(io.fs.readText("/work/dist/build.log.json")) as BuildLog;
    expect(log.summary.lock).toEqual({ rejected_terms: 0, merged: 0, separated: 0, domains: 1 });
    expect(log.summary.domains).toEqual([
      {
        pivot: "glossary/check",
        degree: 4,
        domain: "check",
        notes: ["glossary/check", "glossary/finding", "specs/screens/lint-report"],
      },
    ]);
    expect(log.summary.findings.byCheck[DOMAIN_SUGGESTED_CHECK]).toBe(3);
    expect(io.stderr).toContain(
      'info: I-DOMAIN-SUGGESTED (glossary:finding.md): glossary/finding lies within 1 of glossary/check (degree 4): a candidate for a domain named "check" after it',
    );
  });

  it("writes no suggested domains section without inference.domains", async () => {
    const io = recordedIo({ "/work/concordance.yaml": configText(""), ...corpus });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.stdout.some((line) => line.startsWith("suggested domains"))).toBe(false);
    const log = JSON.parse(io.fs.readText("/work/dist/build.log.json")) as BuildLog;
    expect("domains" in log.summary).toBe(false);
  });
});
