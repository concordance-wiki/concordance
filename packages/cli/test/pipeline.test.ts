import { catalogue, createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  memoryFileSystem,
  parseConfig,
  type CheckContribution,
  type Config,
  type Entity,
  type KeywordCounts,
  type Link,
  type PluginRegistry,
  type SourceInput,
  type SourceOutput,
  type SourceProvider,
  type TermCandidate,
} from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import { loadDefaultProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { enrichStepFindings, runModelChecks } from "../src/pipeline/checks.js";
import { buildDictionaries, corpusLocales } from "../src/pipeline/dictionary.js";
import { reconcileTwins } from "../src/pipeline/duplicates.js";
import { discoverKeywords } from "../src/pipeline/keywords.js";
import { indexDocuments, parseSources } from "../src/pipeline/parse.js";
import { refineRelations } from "../src/pipeline/relations.js";
import { runPipeline, type PipelineInput, type PipelineResult } from "../src/pipeline/run.js";
import { occurrenceScale, typePrefixes } from "../src/pipeline/scan.js";
import { loadPluginSources, methodConfidences } from "../src/pipeline/sources.js";
import { typeNotes } from "../src/pipeline/typing.js";
import { FakeGit } from "./helpers.js";

const profile = loadDefaultProfile();
const clock = fixedClock("2026-09-12T12:00:00Z");

/** A registry double: no plugin loaded, except the contributions given. */
function registryWith(
  sources: SourceProvider[] = [],
  checks: CheckContribution[] = [],
): PluginRegistry {
  return {
    plugins: () => [],
    registrations: () => [],
    readers: () => [],
    converters: () => [],
    sources: () => sources,
    inferenceMethods: () => [],
    checks: () => checks,
    projections: () => [],
    uiComponents: () => [],
    themes: () => [],
    types: () => [],
  };
}

function parsedConfig(text: string): Config {
  const parsed = parseConfig(text);
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  return parsed.config;
}

/** Two sources, a glossary and specs, both under one application and one domain. */
const twoSources = [
  "version: 1",
  "project: { name: Concordance wiki }",
  "applications: [{ id: concordance-cli }]",
  "domains: [{ id: inference, match: ['**/*'] }]",
  "sources:",
  "  - { name: glossary, path: ./glossary, type: term, glossary: true, application: concordance-cli }",
  "  - name: specs",
  "    path: ./specs",
  "    application: concordance-cli",
  "    rules:",
  "      - { match: { path: 'screens/**' }, set: { type: screen } }",
  "      - { match: { path: 'api/**' }, set: { type: api } }",
  "      - { match: { path: 'objects/**' }, set: { type: business_object } }",
  "      - { match: { suffix: '.rule.md' }, set: { type: rule } }",
  "inference: { cross_source_links: true }",
  "",
].join("\n");

interface Corpus {
  input: PipelineInput;
  fs: ReturnType<typeof memoryFileSystem>;
}

/** Ingests an in-memory corpus rooted at /work, local sources only, and prepares the pipeline input. */
async function corpus(
  files: Record<string, string>,
  configText = twoSources,
  options: Partial<PipelineInput> = {},
): Promise<Corpus> {
  const fs = memoryFileSystem({ "/work/concordance.yaml": configText, ...files });
  const config = parsedConfig(configText);
  const ingested = await ingestSources(config, {
    fs,
    git: new FakeGit(fs),
    configDirectory: "/work",
    cacheDirectory: "/work/.concordance-cache",
  });
  return {
    fs,
    input: {
      config,
      profile,
      configDirectory: "/work",
      cacheDirectory: "/work/.concordance-cache",
      sources: ingested.sources,
      findings: ingested.findings,
      plugins: registryWith(),
      checks: createRegistry(),
      fs,
      clock,
      ...options,
    },
  };
}

const methodsOf = (link: Link): string[] => [
  ...new Set(link.provenance.map((provenance) => provenance.method)),
];

const linkBetween = (result: PipelineResult, from: string, to: string): Link[] =>
  result.links.filter((link) => link.from === from && link.to === to);

/**
 * A corpus that exercises every producer: a glossary term with an alias, a screen note with a
 * frontmatter reference, a mapped section, a written link and prose mentions, an expression
 * repeated without a note, and a base name shared across the two sources.
 */
const richCorpus: Record<string, string> = {
  "/work/glossary/mention.md": [
    "---",
    "aliases: [mentions]",
    "---",
    "# Mention",
    "",
    "An occurrence of a term in a note. The build summary counts mentions per page.",
    "",
  ].join("\n"),
  "/work/glossary/finding.md": [
    "# Finding",
    "",
    "What a check reports. The build summary lists findings per severity.",
    "",
  ].join("\n"),
  "/work/specs/screens/mentions-panel.md": [
    "---",
    "reads: [objects/finding]",
    "---",
    "# Mentions panel",
    "",
    "Shows every mention of the entity, as the [glossary](../../glossary/mention.md) defines it.",
    "The build summary is printed after the panel is rendered.",
    "",
    "## Objects",
    "",
    "- [Finding](../objects/finding.md)",
    "",
  ].join("\n"),
  // The same title as the glossary term: a homonym, and the same base name in another source.
  "/work/specs/objects/finding.md": [
    "# Finding",
    "",
    "The finding as the model records it; the mentions panel reads it.",
    "",
  ].join("\n"),
};

describe("The build runs every implemented step in order", () => {
  it("parses, types, recognises, links, combines, discovers keywords, reconciles twins and checks one corpus", async () => {
    const { input } = await corpus(richCorpus);
    const result = await runPipeline(input);

    // Typing: one entity per note, then one keyword page for the recurring expression.
    const notes = result.entities.filter((entity) => entity.keyword !== true);
    expect(notes.map((entity) => `${entity.id}:${entity.type}`)).toEqual([
      "glossary/finding:term",
      "glossary/mention:term",
      "specs/objects/finding:business_object",
      "specs/screens/mentions-panel:screen",
    ]);
    const keywords = result.entities.filter((entity) => entity.keyword === true);
    expect(keywords.map((entity) => entity.id)).toContain("keywords/build-summary");
    expect(result.keywords.published).toBe(keywords.length);
    expect(result.files).toBe(4);

    // Links: the written link, the frontmatter reference, the mapped section, the prose mentions
    // and the co-occurrence, combined into one link per source, target and relation; the pair
    // screen and term admits several relations, so the written link and the mention stay
    // `related`, undirected, from the lower identifier, capped and reported once.
    const panel = "specs/screens/mentions-panel";
    expect(linkBetween(result, panel, "glossary/mention")).toEqual([]);
    expect(
      linkBetween(result, "glossary/mention", panel).map((link) => [
        methodsOf(link),
        link.relation,
        link.confidence,
      ]),
    ).toEqual([[["explicit_link", "glossary_occurrence"], "related", 0.6]]);
    // The homonym under the mapped section is a term too: the section names no relation for it.
    expect(
      result.findings
        .filter((finding) => finding.check === "I-REL-AMBIGUOUS")
        .map((finding) => [finding.entity, finding.path, finding.line]),
    ).toEqual([
      [panel, "screens/mentions-panel.md", 6],
      [panel, "screens/mentions-panel.md", 11],
    ]);
    // The frontmatter reference carries the mode of the attribute; the section mention shares
    // none, and the written link, the prose mention and the co-occurrence, named `accesses` by
    // the only relation the pair admits, fold into it: two links of one relation, apart by their
    // attributes.
    const accesses = linkBetween(result, panel, "specs/objects/finding").filter(
      (link) => link.relation === "accesses",
    );
    expect(accesses.map((link) => [methodsOf(link), link.attributes, link.confidence])).toEqual([
      [["frontmatter_ref"], { mode: "read" }, 0.9],
      [["cooccurrence", "explicit_link", "glossary_occurrence", "section_mention"], {}, 1],
    ]);
    expect(linkBetween(result, panel, "specs/objects/finding")).toEqual(accesses);
    expect(
      result.links.some((link) => link.provenance.some((p) => p.method === "cooccurrence")),
    ).toBe(true);
    expect(result.links.map((link) => `${link.from} ${link.to} ${link.relation}`)).toEqual(
      [...result.links]
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
        .map((link) => `${link.from} ${link.to} ${link.relation}`),
    );

    // Keywords, twins and checks fill their blocks.
    expect(result.candidates.terms.find((term) => term.text === "build summary")).toMatchObject({
      normalized: "build summary",
      occurrences: 3,
      documents: 3,
      page: true,
    });
    expect(result.candidates.duplicates).toEqual([
      {
        resources: ["glossary/finding", "specs/objects/finding"],
        score: 0.5,
        signals: ["same_name"],
      },
    ]);
    expect(result.duplicates).toMatchObject({ resources: 4, merged: 0, candidates: 1 });
    expect(Object.keys(result.neighbours).length).toBeGreaterThan(0);
    expect(Object.keys(result.displayedNeighbourhood)).toEqual(
      result.entities.map((entity) => entity.id).sort(),
    );
    expect(result.displayedNeighbourhood[panel]?.slice(0, 2)).toMatchObject([
      { id: "specs/objects/finding", kind: "entity", confidence: 1 },
      { id: "glossary/mention", kind: "entity", confidence: 0.6 },
    ]);
    expect(result.contracts).toEqual([]);
    expect(result.candidates).not.toHaveProperty("objects");
    const checks = new Set(result.findings.map((finding) => finding.check));
    expect([...checks].sort()).toEqual([
      "I-REL-AMBIGUOUS",
      "I-TERM-HOMONYM",
      "W-DUP-CANDIDATE",
      "W-TERM-UNDEFINED",
    ]);
  });

  it("recognises with the dictionary and the pack of each locale and scans the notes of every source", async () => {
    const config = [
      "version: 1",
      "project: { name: Concordance wiki, locale: en }",
      "sources:",
      "  - { name: glossary, path: ./glossary, type: term, glossary: true }",
      "  - { name: glossaire, path: ./glossaire, type: term, glossary: true, locale: fr }",
      "",
    ].join("\n");
    const { input } = await corpus(
      {
        "/work/glossary/keyword-page.md": "# Keyword page\n\nA page without a note.\n",
        "/work/glossary/note.md": "# Note\n\nKeyword pages complete the notes.\n",
        "/work/glossaire/page-mot-cle.md": "# Page mot-clé\n\nUne page sans note.\n",
        "/work/glossaire/note.md": "# Note\n\nLes pages mots-clés complètent les notes.\n",
      },
      config,
    );
    const result = await runPipeline(input);
    expect(corpusLocales(input.sources)).toEqual(["en", "fr"]);
    const mentions = result.links.filter((link) =>
      link.provenance.some((p) => p.method === "glossary_occurrence"),
    );
    expect(mentions.map((link) => `${link.from} -> ${link.to}`)).toEqual([
      "glossaire/note -> glossaire/page-mot-cle",
      "glossary/keyword-page -> glossary/note",
    ]);
    expect(
      result.entities
        .filter((entity) => entity.keyword !== true)
        .map((entity) => `${entity.id} ${entity.locale}`),
    ).toEqual([
      "glossaire/note fr",
      "glossaire/page-mot-cle fr",
      "glossary/keyword-page en",
      "glossary/note en",
    ]);
  });

  it("finds the homonym pairs of one locale only: two sources of one locale share a dictionary", async () => {
    const { input } = await corpus(richCorpus);
    const parsed = parseSources(input.sources, input.fs);
    const typed = typeNotes({
      sources: input.sources,
      documents: indexDocuments(parsed.documents),
      config: input.config,
      profile,
    });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    expect([...dictionaries.byLocale.keys()]).toEqual(["en"]);
    expect([...(dictionaries.byLocale.get("en")?.dictionary.entries.keys() ?? [])]).toEqual([
      "finding",
      "mention",
      "mention panel",
    ]);
    expect(dictionaries.byLocale.get("en")?.dictionary.entries.get("finding")?.homonym).toBe(true);
    expect(dictionaries.findings.map((finding) => finding.check)).toEqual(["I-TERM-HOMONYM"]);
    expect(dictionaries.byLocale.get("en")?.stopwords.has("the")).toBe(true);
  });
});

describe("Every step's findings are collected, enriched by the registry, sorted canonically and written once", () => {
  it("keeps one finding per step, from ingestion to the model checks, each with a remediation", async () => {
    const config = [
      "version: 1",
      "project: { name: Concordance wiki }",
      "applications: [{ id: concordance-cli }]",
      "domains: [{ id: inference, match: ['**/*'] }]",
      "sources:",
      "  - { name: gone, git: https://forge.example/gone.git, application: concordance-cli }",
      "  - { name: glossary, path: ./glossary, type: term, glossary: true, application: concordance-cli }",
      "  - name: specs",
      "    path: ./specs",
      "    application: concordance-cli",
      "    rules:",
      "      - { match: { path: 'screens/**' }, set: { type: screen } }",
      "      - { match: { path: 'api/**' }, set: { type: api } }",
      "      - { match: { path: 'objects/**' }, set: { type: business_object } }",
      "",
    ].join("\n");
    const files: Record<string, string> = {
      // Parsing: a broken frontmatter.
      "/work/glossary/broken.md": "---\nkey: [\n---\n# Broken\n",
      // Dictionary: two notes titled alike are homonyms; twins: the same base name in two sources.
      // Relation typing: a prose mention of a screen by a term, a pair the profile leaves ambiguous.
      "/work/glossary/source.md":
        "# Source\n\nA declared repository, listed on the entity page. The cold start is slow.\n",
      "/work/specs/objects/source.md":
        "# Source\n\nA representation twin. The cold start is slow.\n",
      // Typing: an attribute the profile does not declare; links: a written link to a missing file;
      // frontmatter: a reference that names nothing; keywords: an expression three times in two files.
      "/work/specs/screens/entity-page.md": [
        "---",
        "colour: blue",
        "reads: [objects/missing]",
        "---",
        "# Entity page",
        "",
        "Shows the [note](../notes/gone.md). The cold start is slow.",
        "",
      ].join("\n"),
      // Model checks: an api that nothing consumes.
      "/work/specs/api/model-query.md": "---\nprotocol: rest\n---\n# Model query API\n",
    };
    const fs = memoryFileSystem({ "/work/concordance.yaml": config, ...files });
    const git = new FakeGit(fs);
    git.failing.add("https://forge.example/gone.git");
    const parsed = parsedConfig(config);
    const ingested = await ingestSources(parsed, {
      fs,
      git,
      configDirectory: "/work",
      cacheDirectory: "/work/.concordance-cache",
    });
    // Plugin sources: a provider whose contract cannot be read.
    const unreachable: SourceProvider = {
      kind: "openapi",
      load: () =>
        Promise.resolve({
          entities: [],
          links: [],
          candidates: [],
          contracts: [],
          findings: [
            {
              check: "W-CONTRACT-UNREACHABLE",
              severity: "warning",
              message:
                "contract contracts/model-query.openapi.json of specs/api/model-query could not be read: file missing",
              remediation: "fix the contract path",
              source: "specs",
              path: "api/model-query.md",
            },
          ],
        }),
    };
    const result = await runPipeline({
      config: parsed,
      profile,
      configDirectory: "/work",
      cacheDirectory: "/work/.concordance-cache",
      sources: ingested.sources,
      // Plugin loading reports before the pipeline runs: its finding travels with ingestion's.
      findings: [
        {
          check: "W-PLUGIN-DISABLED",
          severity: "warning",
          message: "plugin example is disabled: its system dependency soffice is missing",
          remediation: "install it",
        },
        ...ingested.findings,
      ],
      plugins: registryWith([unreachable]),
      checks: createRegistry(),
      fs,
      clock,
    });
    const byCheck = new Map<string, number>();
    for (const finding of result.findings) {
      byCheck.set(finding.check, (byCheck.get(finding.check) ?? 0) + 1);
    }
    expect(Object.fromEntries(byCheck)).toEqual({
      "E-FM-INVALID": 1,
      "E-LINK-BROKEN": 1,
      "I-REL-AMBIGUOUS": 1,
      "I-TERM-HOMONYM": 1,
      "W-API-NOCONSUMER": 1,
      "W-ATTRIBUTE-UNKNOWN": 1,
      "W-CONTRACT-UNREACHABLE": 1,
      "W-DUP-CANDIDATE": 1,
      "W-PLUGIN-DISABLED": 1,
      "W-REF-UNRESOLVED": 1,
      "W-SOURCE-UNREACHABLE": 1,
      "W-TERM-UNDEFINED": 1,
    });
    expect(result.findings.map((finding) => finding.check)).toEqual(
      [...result.findings.map((finding) => finding.check)].sort((a, b) => a.localeCompare(b)),
    );
    for (const finding of result.findings) {
      expect(finding.remediation, finding.check).not.toBe("");
    }
    // The longer expression wins: "cold start" is nested in it and penalised below the threshold.
    expect(result.findings.find((f) => f.check === "W-TERM-UNDEFINED")?.message).toContain(
      '"cold start is slow" is used 3 times in 3 files',
    );
  });

  it("applies the checks overrides of the configuration to step findings and model checks alike", async () => {
    const config = `${twoSources}checks:\n  I-REL-AMBIGUOUS: { enabled: false }\n  I-TERM-HOMONYM: { severity: warning }\n`;
    const { input } = await corpus(richCorpus, config);
    const result = await runPipeline(input);
    const checks = result.findings.map((finding) => finding.check);
    expect(checks).not.toContain("I-REL-AMBIGUOUS");
    expect(result.findings.find((f) => f.check === "I-TERM-HOMONYM")?.severity).toBe("warning");
  });

  it("completes a missing remediation from the catalogue when enriching step findings", () => {
    const enriched = enrichStepFindings(createRegistry(), [
      { check: "E-LINK-BROKEN", severity: "error", message: "gone" },
    ]);
    expect(enriched[0]?.remediation).toBe(
      catalogue.find((definition) => definition.id === "E-LINK-BROKEN")?.remediation,
    );
  });
});

describe("Sources contributions of plugins run after typing and add their endpoint entities, exposes links, candidates and contracts records", () => {
  const record = {
    api: "specs/api/model-query",
    location: "contracts/model-query.openapi.json",
    title: "Model query",
    version: "1.0.0",
    format: "openapi 3.1",
    fingerprint: "a".repeat(64),
    imported_at: "2026-09-12T12:00:00.000Z",
  };

  /** A provider that turns the api note it receives into one endpoint, the way the contract plugins do. */
  function contractProvider(seen: SourceInput[]): SourceProvider {
    return {
      kind: "openapi",
      load: (input) => {
        seen.push(input);
        const api = input.payload.entities.find((entity) => entity.type === "api");
        if (api === undefined) throw new Error("the provider runs after typing");
        const endpoint: Entity = {
          id: `${api.id}/list-entities`,
          type: "endpoint",
          title: "GET /entities",
          aliases: ["listEntities"],
          locale: api.locale,
          status: "valid",
          type_origin: "contract",
          graph: "full",
          attributes: { method: "GET", path: "/entities", style: "http" },
          source: { name: api.source.name, path: record.location, line: 1 },
        };
        const confidence = input.payload.confidence.contract_import ?? 0;
        const output: SourceOutput = {
          entities: [endpoint],
          links: [
            {
              from: api.id,
              to: endpoint.id,
              relation: "exposes",
              confidence,
              provenance: [
                {
                  method: "contract_import",
                  confidence,
                  path: record.location,
                  operation: "listEntities",
                },
              ],
            },
          ],
          candidates: [{ kind: "object", name: "Entity", from: api.id, contract: record.location }],
          contracts: [record],
          findings: [],
        };
        return Promise.resolve(output);
      },
    };
  }

  const apiCorpus: Record<string, string> = {
    "/work/glossary/entity.md": "# Entity\n\nA node of the model.\n",
    "/work/specs/api/model-query.md":
      "---\nprotocol: rest\ncontract: contracts/model-query.openapi.json\n---\n# Model query API\n\nServes the model.\n",
    "/work/specs/screens/search-results.md":
      "# Search results\n\nCalls listEntities to fill the page.\n",
  };

  it("hands the typed entities, the source roots, the file dates, the cache and the profile confidences to every provider", async () => {
    const seen: SourceInput[] = [];
    const fetchDouble: typeof fetch = () => Promise.reject(new Error("offline"));
    const { input } = await corpus(apiCorpus, twoSources, {
      plugins: registryWith([contractProvider(seen)]),
      fetch: fetchDouble,
    });
    await runPipeline(input);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.payload.entities.map((entity) => entity.id)).toEqual([
      "glossary/entity",
      "specs/api/model-query",
      "specs/screens/search-results",
    ]);
    expect(seen[0]?.payload.roots).toEqual({ glossary: "/work/glossary", specs: "/work/specs" });
    expect(seen[0]?.payload.dates).toEqual({
      glossary: { "entity.md": "1970-01-01T00:00:00.000Z" },
      specs: {
        "api/model-query.md": "1970-01-01T00:00:00.000Z",
        "screens/search-results.md": "1970-01-01T00:00:00.000Z",
      },
    });
    expect(seen[0]?.payload.cacheDirectory).toBe("/work/.concordance-cache");
    expect(seen[0]?.payload.confidence).toEqual(methodConfidences(profile));
    expect(seen[0]?.context.fetch).toBe(fetchDouble);
    expect(seen[0]?.context.clock).toBe(clock);
  });

  it("runs without network access when no fetch is injected", async () => {
    const seen: SourceInput[] = [];
    const { input } = await corpus(apiCorpus, twoSources, {
      plugins: registryWith([contractProvider(seen)]),
    });
    await runPipeline(input);
    expect(seen[0]?.context).not.toHaveProperty("fetch");
  });

  it("adds the endpoint, its exposes link, the candidate object and the contract record to the model", async () => {
    const { input } = await corpus(apiCorpus, twoSources, {
      plugins: registryWith([contractProvider([])]),
    });
    const result = await runPipeline(input);
    const endpoint = result.entities.find((entity) => entity.type === "endpoint");
    expect(endpoint?.id).toBe("specs/api/model-query/list-entities");
    const exposes = linkBetween(result, "specs/api/model-query", endpoint?.id ?? "");
    expect(exposes.map((link) => link.relation)).toEqual(["exposes"]);
    expect(exposes[0]?.confidence).toBe(0.95);
    expect(result.candidates.objects).toEqual([
      {
        kind: "object",
        name: "Entity",
        from: "specs/api/model-query",
        contract: record.location,
      },
    ]);
    expect(result.contracts).toEqual([record]);
  });

  it("enters the imported endpoints in the dictionary, so that a note naming an operation links to it", async () => {
    const { input } = await corpus(apiCorpus, twoSources, {
      plugins: registryWith([contractProvider([])]),
    });
    const result = await runPipeline(input);
    // An undirected mention goes from the lower identifier: the endpoint's.
    const mention = linkBetween(
      result,
      "specs/api/model-query/list-entities",
      "specs/screens/search-results",
    );
    expect(mention.flatMap(methodsOf)).toEqual(["glossary_occurrence"]);
    expect(mention[0]?.provenance[0]).toMatchObject({ path: "screens/search-results.md", line: 3 });
  });

  it("merges the outputs of several providers in canonical order", async () => {
    const second: SourceProvider = {
      kind: "wsdl",
      load: () =>
        Promise.resolve({
          entities: [],
          links: [],
          candidates: [
            { kind: "object", name: "Entity", from: "specs/api/model-query", contract: "b.wsdl" },
            { kind: "object", name: "Alpha", from: "specs/api/model-query", contract: "a.wsdl" },
          ],
          contracts: [{ ...record, api: "specs/api/forge-bridge", location: "a.wsdl" }],
          findings: [],
        }),
    };
    const seen: SourceInput[] = [];
    const loaded = await loadPluginSources({
      providers: [contractProvider(seen), second],
      entities: [
        {
          id: "specs/api/model-query",
          type: "api",
          title: "Model query API",
          aliases: [],
          locale: "en",
          status: "valid",
          type_origin: "rule#2",
          graph: "full",
          attributes: {},
          source: { name: "specs", path: "api/model-query.md", line: 1 },
        },
      ],
      roots: { specs: "/work/specs" },
      cacheDirectory: "/cache",
      profile,
      context: { fs: memoryFileSystem(), clock },
    });
    expect(loaded.objects.map((object) => `${object.name} ${object.contract}`)).toEqual([
      "Alpha a.wsdl",
      "Entity b.wsdl",
      `Entity ${record.location}`,
    ]);
    expect(loaded.contracts.map((contract) => contract.api)).toEqual([
      "specs/api/forge-bridge",
      "specs/api/model-query",
    ]);
    expect(loaded.entities).toHaveLength(1);
    expect(loaded.links).toHaveLength(1);
    expect(seen[0]?.payload).not.toHaveProperty("dates");
  });

  it("gives a provider every scalar confidence of the profile and leaves the glossary scale out", () => {
    expect(methodConfidences(profile)).toEqual({
      explicit_link: 1,
      lock_promoted: 1,
      contract_import: 0.95,
      frontmatter_ref: 0.9,
      folder_zone: 0.9,
      section_mention: 0.7,
      cooccurrence: 0.4,
      embedding: 0.25,
    });
    const sparse: Profile = { ...profile, confidence: { explicit_link: 1 } };
    expect(methodConfidences(sparse)).toEqual({ explicit_link: 1 });
  });
});

describe("occurrence scan options", () => {
  it("resolves the glossary scale of the profile, the specification's defaults filling the gaps", () => {
    expect(occurrenceScale(profile)).toEqual({
      base: 0.6,
      per_occurrence: 0.05,
      cap: 0.8,
      homonym_factor: 0.5,
      type_prefix_bonus: 0.1,
    });
    expect(
      occurrenceScale({
        ...profile,
        confidence: { glossary_occurrence: { base: 0.5, per_occurrence: 0.1, cap: 0.9 } },
      }),
    ).toEqual({
      base: 0.5,
      per_occurrence: 0.1,
      cap: 0.9,
      homonym_factor: 0.5,
      type_prefix_bonus: 0.1,
    });
    expect(occurrenceScale({ ...profile, confidence: {} })).toEqual(occurrenceScale(profile));
  });

  it("takes the type prefixes of the locale, falling back to its language, each type overridable in the configuration", () => {
    const config = parsedConfig(twoSources);
    expect(typePrefixes(profile, config, "en")["screen"]).toEqual(["screen", "page"]);
    expect(typePrefixes(profile, config, "fr-CA")["screen"]).toEqual(["écran", "page"]);
    const overridden: Config = {
      ...config,
      inference: { type_prefixes: { en: { screen: ["view"] } } },
    };
    expect(typePrefixes(profile, overridden, "en")).toMatchObject({
      screen: ["view"],
      api: ["api", "service"],
    });
    expect(typePrefixes({ ...profile, type_prefixes: {} }, config, "de")).toEqual({});
  });
});

describe("relation typing step", () => {
  const entity = (id: string, type: string, path: string): Entity => ({
    id,
    type,
    title: id,
    aliases: [],
    locale: "en",
    status: "active",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: "specs", path, line: 1 },
  });
  const entities = [
    entity("specs/screens/entity-page", "screen", "screens/entity-page.md"),
    entity("specs/objects/entity", "business_object", "objects/entity.md"),
    entity("specs/roles/reader", "role", "roles/reader.md"),
    entity("glossary/source", "term", "source.md"),
  ];
  const related = (from: string, to: string, path: string): Link => ({
    from,
    to,
    relation: "related",
    confidence: 0.6,
    provenance: [{ method: "glossary_occurrence", confidence: 0.6, path, line: 3 }],
  });

  it("names a related link from its type pair, keeps an ambiguous one capped with I-REL-AMBIGUOUS and drops a forbidden relation with E-META-REL", () => {
    const refined = refineRelations(
      [
        related("specs/screens/entity-page", "specs/objects/entity", "screens/entity-page.md"),
        related("glossary/source", "specs/screens/entity-page", "source.md"),
        {
          from: "specs/roles/reader",
          to: "specs/objects/entity",
          relation: "accesses",
          attributes: { mode: "read" },
          confidence: 0.9,
          provenance: [
            { method: "frontmatter_ref", confidence: 0.9, path: "roles/reader.md", line: 1 },
          ],
        },
      ],
      { profile, entities },
    );
    expect(
      refined.links.map((link) => [link.from, link.to, link.relation, link.confidence]),
    ).toEqual([
      ["glossary/source", "specs/screens/entity-page", "related", 0.6],
      ["specs/screens/entity-page", "specs/objects/entity", "accesses", 0.6],
    ]);
    expect(refined.findings.map((f) => [f.check, f.source, f.path, f.line, f.entity])).toEqual([
      ["E-META-REL", "specs", "roles/reader.md", 1, "specs/roles/reader"],
      ["I-REL-AMBIGUOUS", "specs", "source.md", 3, "glossary/source"],
    ]);
  });
});

describe("keyword discovery and publication", () => {
  it("numbers the page of a second locale whose expression slugifies like one already published", async () => {
    const config = [
      "version: 1",
      "project: { name: Concordance wiki }",
      "sources:",
      "  - { name: notes, path: ./notes }",
      "  - { name: fiches, path: ./fiches, locale: fr }",
      "",
    ].join("\n");
    const repeated = "Cache warmup runs first. Cache warmup is measured.\n";
    const { input } = await corpus(
      {
        "/work/notes/a.md": `# A\n\n${repeated}`,
        "/work/notes/b.md": `# B\n\n${repeated}`,
        "/work/fiches/a.md": `# A\n\n${repeated}`,
        "/work/fiches/b.md": `# B\n\n${repeated}`,
      },
      config,
    );
    const result = await runPipeline(input);
    const pages = result.entities.filter((entity) => entity.keyword === true);
    expect(
      pages
        .filter((page) => page.title.toLowerCase() === "cache warmup")
        .map((page) => `${page.id} ${page.locale}`),
    ).toEqual(["keywords/cache-warmup en", "keywords/cache-warmup-2 fr"]);
    expect(new Set(pages.map((page) => page.id)).size).toBe(pages.length);
    expect(result.keywords).toEqual({ published: pages.length, discarded: 0, withheld: 0 });
  });

  it("counts the expressions the publication threshold discards and records them as terms without a page", async () => {
    const config = `${twoSources}inference: { keyword_pages: { min_occurrences: 4, min_files: 2 } }\n`;
    const { input } = await corpus(
      richCorpus,
      config.replace("inference: { cross_source_links: true }\n", ""),
    );
    const parsed = parseSources(input.sources, input.fs);
    const typed = typeNotes({
      sources: input.sources,
      documents: indexDocuments(parsed.documents),
      config: input.config,
      profile,
    });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const discovered = discoverKeywords({
      documents: parsed.documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
    });
    expect(discovered.counts.published).toBe(0);
    expect(discovered.counts.discarded).toBeGreaterThan(0);
    expect(discovered.entities).toEqual([]);
    expect(discovered.terms.every((term) => term.page === false)).toBe(true);
    expect(discovered.terms[0]?.contexts?.[0]).toMatchObject({
      line: expect.any(Number) as number,
    });
  });
});

describe("keyword discovery reads the confidence of every candidate", () => {
  /** Discovery over an in-memory corpus, the terms keyed by their text, with the counts. */
  async function discovered(
    files: Record<string, string>,
    configText = twoSources,
  ): Promise<{ terms: Map<string, TermCandidate>; counts: KeywordCounts }> {
    const { input } = await corpus(files, configText);
    const parsed = parseSources(input.sources, input.fs);
    const typed = typeNotes({
      sources: input.sources,
      documents: indexDocuments(parsed.documents),
      config: input.config,
      profile,
    });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const result = discoverKeywords({
      documents: parsed.documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
    });
    return { terms: new Map(result.terms.map((term) => [term.text, term])), counts: result.counts };
  }

  /** Six notes, each using "cache warmup" once in passing, and "cold start" treated in two. */
  const passing: Record<string, string> = Object.fromEntries(
    ["a", "b", "c", "d", "e", "f"].map((name) => [
      `/work/specs/screens/${name}.md`,
      `# Screen ${name}\n\nThe cache warmup runs first.\n`,
    ]),
  );
  const treated: Record<string, string> = {
    "/work/specs/screens/g.md":
      "---\naliases: [cold start delay]\nsummary: A cold start is slow.\ndepth: 2\n---\n# Screen g\n\n## Cold start\n\nA cold start reads every file; the cold start is slow. See [cold start](./h.md).\n",
    "/work/specs/screens/h.md":
      "# Second screen\n\n## Cold start\n\nThe cold start of this screen; a cold start again.\n",
  };

  it("withholds an expression mentioned once in each of five files and records why, without a page", async () => {
    const { terms, counts } = await discovered({ ...passing, ...treated });
    const warmup = terms.get("cache warmup");
    expect(warmup).toMatchObject({
      page: false,
      withheld: true,
      confidence: 0.36,
      penalties: ["burst"],
    });
    expect(warmup?.signals).toEqual({
      spread: 0.75,
      burst: 1,
      prominence: 0,
      neighbour: false,
      inflected: false,
    });
    // The parts and the longer n-grams of both expressions share their fate.
    expect(counts).toEqual({ published: 3, discarded: 0, withheld: 6 });
  });

  it("counts the headings, the written links and the frontmatter strings as prominent texts, never as usage", async () => {
    const { terms } = await discovered({ ...passing, ...treated });
    const cold = terms.get("cold start");
    // Five usages; put forward by two headings, one link, one alias and one summary.
    expect(cold).toMatchObject({ page: true, occurrences: 5, documents: 2, confidence: 0.9 });
    expect(cold?.withheld).toBeUndefined();
    expect(cold?.signals).toEqual({
      spread: 0.25,
      burst: 2.5,
      prominence: 1,
      neighbour: false,
      inflected: false,
    });
  });

  it("publishes a withheld expression when min_confidence is lowered", async () => {
    const config = `${twoSources}inference: { keyword_pages: { min_confidence: 0.3 } }\n`;
    const { terms, counts } = await discovered(
      { ...passing, ...treated },
      config.replace("inference: { cross_source_links: true }\n", ""),
    );
    expect(terms.get("cache warmup")).toMatchObject({ page: true, confidence: 0.36 });
    expect(terms.get("cache warmup")?.withheld).toBeUndefined();
    expect(counts).toEqual({ published: 9, discarded: 0, withheld: 0 });
  });
});

describe("keyword discovery reads usage, not titles", () => {
  /** Discovery over an in-memory corpus, the terms with their occurrences and contexts keyed by their text. */
  async function discoveredTerms(
    files: Record<string, string>,
  ): Promise<Map<string, { occurrences: number; contexts: string[] }>> {
    const { input } = await corpus(files);
    const parsed = parseSources(input.sources, input.fs);
    const typed = typeNotes({
      sources: input.sources,
      documents: indexDocuments(parsed.documents),
      config: input.config,
      profile,
    });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const result = discoverKeywords({
      documents: parsed.documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
    });
    return new Map(
      result.terms.map((term) => [
        term.text,
        {
          occurrences: term.occurrences,
          contexts: (term.contexts ?? []).map((context) => context.context),
        },
      ]),
    );
  }

  /** Discovery over an in-memory corpus, the terms keyed by their text. */
  async function discovered(files: Record<string, string>): Promise<Map<string, number>> {
    const terms = await discoveredTerms(files);
    return new Map([...terms].map(([text, term]) => [text, term.occurrences]));
  }

  it("quotes the inline code of a unit in the contexts it never reads, the code of a stripped label gone with it", async () => {
    const terms = await discoveredTerms({
      "/work/specs/screens/a.md":
        "# A\n\nSet `lint.max` before the cache warmup runs.\n\n## Objects\n\n- `Reads`: the `cache` of the cache warmup\n",
      "/work/specs/screens/b.md": "# B\n\nThe cache warmup `cache.warm` runs `nightly`.\n",
      "/work/specs/screens/c.md":
        "# C\n\n- Reads: `x` before the cache warmup\n- Reads`y`:`z`the cache warmup again\n",
    });
    expect(terms.has("lint")).toBe(false);
    expect(terms.has("nightly")).toBe(false);
    // A label written as code is no label: the item is read whole, and quoted as written.
    expect(terms.get("cache warmup")?.contexts).toEqual([
      "Set lint.max before the cache warmup runs.",
      "Reads: the cache of the cache warmup",
      "The cache warmup cache.warm runs nightly.",
      "x before the cache warmup",
      "zthe cache warmup again",
    ]);
    expect(terms.has("Reads")).toBe(false);
  });

  it("leaves every heading out: an expression that only titles sections never becomes a candidate", async () => {
    const terms = await discovered({
      "/work/specs/screens/a.md": "# Cache warmup\n\n## Cache warmup\n\nA paragraph.\n",
      "/work/specs/screens/b.md": "## Cache warmup\n\nAnother paragraph.\n",
      "/work/specs/screens/c.md": "## Cache warmup\n\nA third paragraph.\n",
    });
    expect(terms.has("Cache warmup")).toBe(false);
  });

  it("strips the label a list item opens with when it is a mapped section heading, and reads the rest", async () => {
    const terms = await discovered({
      "/work/specs/screens/a.md":
        "# A\n\n## Objects\n\n- Reads: cache warmup entity\n- Writes: cache warmup log\n",
      "/work/specs/screens/b.md":
        "# B\n\n## Objects\n\n- Reads: cache warmup entity\n- Lit : rien\n",
      // A label with nothing after it leaves no unit to read.
      "/work/specs/screens/c.md": "# C\n\n- Reads: cache warmup entity\n- Objects:\n",
    });
    expect(terms.has("Reads")).toBe(false);
    expect(terms.has("Objects")).toBe(false);
    expect(terms.has("Writes")).toBe(false);
    expect(terms.has("Lit")).toBe(false);
    expect(terms.get("cache warmup")).toBe(4);
  });

  it("keeps a label outside that vocabulary, a colon deep in the prose and a list item without one", async () => {
    const deep = "- The build summary of the nightly build is printed last: cache warmup first.\n";
    const terms = await discovered({
      "/work/specs/screens/a.md": `# A\n\n- Detail: cache warmup entity\n${deep}`,
      "/work/specs/screens/b.md": `# B\n\n- Detail: cache warmup entity\n${deep}`,
      "/work/specs/screens/c.md": `# C\n\n- Detail: cache warmup entity\n${deep}- cache warmup: a list item\n`,
    });
    expect(terms.get("Detail")).toBe(3);
    expect(terms.get("build summary")).toBe(3);
    expect(terms.get("cache warmup")).toBe(7);
  });
});

describe("twin-resource reconciliation over the markdown notes", () => {
  const twinConfig = [
    "version: 1",
    "project: { name: Concordance wiki }",
    "sources:",
    "  - { name: meetings, path: ./meetings, default_type: meeting }",
    "  - { name: decks, path: ./decks, default_type: document }",
    "",
  ].join("\n");

  async function reconciled(
    files: Record<string, string>,
    lock?: { separated: [string, string][] },
  ) {
    const { input } = await corpus(files, twinConfig);
    const parsed = parseSources(input.sources, input.fs);
    const documents = indexDocuments(parsed.documents);
    const typed = typeNotes({ sources: input.sources, documents, config: input.config, profile });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const written = (from: string, to: string): Link => ({
      from,
      to,
      relation: "related",
      confidence: 1,
      provenance: [{ method: "explicit_link", confidence: 1, path: `${from}.md`, line: 1 }],
    });
    const links: Link[] = [
      written("meetings/2026-03-12-links-workshop", "decks/2026-03-12-links-workshop"),
      written("decks/2026-03-12-links-workshop", "meetings/other"),
      written("meetings/other", "meetings/2026-03-12-links-workshop"),
    ];
    return reconcileTwins({
      entities: typed.entities,
      links,
      documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
      clock,
      ...(lock === undefined ? {} : { lock }),
    });
  }

  const workshop = "# Links workshop\n\nThe workshop reviewed every written link of the corpus.\n";
  const twins = {
    "/work/meetings/2026-03-12-links-workshop.md": workshop,
    "/work/decks/2026-03-12-links-workshop.md": `---\nsource: meetings:2026-03-12-links-workshop.md\n---\n${workshop}`,
    "/work/meetings/other.md": "# Other\n\nAnother meeting.\n",
  };

  it("merges a note that declares its twin under source into one entity carrying both representations", async () => {
    const result = await reconciled(twins);
    // Both representations are notes: the group keeps the lowest identifier.
    expect(result.entities.map((entity) => entity.id)).toEqual([
      "decks/2026-03-12-links-workshop",
      "meetings/other",
    ]);
    expect(result.entities[0]).toMatchObject({
      representations: [
        { path: "2026-03-12-links-workshop.md", format: "markdown" },
        { path: "2026-03-12-links-workshop.md", format: "markdown" },
      ],
      grouped_by: "declared in frontmatter",
    });
    expect(result.counts).toMatchObject({ resources: 3, merged: 1, candidates: 0 });
    expect(result.findings).toEqual([]);
  });

  it("re-points the links of a merged twin at its note, drops the self-link and combines again", async () => {
    const result = await reconciled(twins);
    expect(result.links.map((link) => `${link.from} -> ${link.to}`)).toEqual([
      "decks/2026-03-12-links-workshop -> meetings/other",
      "meetings/other -> decks/2026-03-12-links-workshop",
    ]);
  });

  it("reports a candidate pair that stays separate and records it under candidates", async () => {
    const result = await reconciled({
      "/work/meetings/workshop.md": workshop,
      // A note without a heading: the deck has no title to compare.
      "/work/decks/workshop.md": "Slides of the workshop.\n",
      "/work/meetings/other.md": "# Other\n\nAnother meeting.\n",
    });
    expect(result.findings.map((finding) => finding.check)).toEqual(["W-DUP-CANDIDATE"]);
    expect(result.candidates).toEqual([
      { resources: ["decks/workshop", "meetings/workshop"], score: 0.5, signals: ["same_name"] },
    ]);
    expect(result.entities).toHaveLength(3);
    expect(result.links).toHaveLength(3);
  });

  it("applies the lock it is given: a separated pair yields neither a merge nor a finding", async () => {
    const result = await reconciled(twins, {
      separated: [["decks/2026-03-12-links-workshop", "meetings/2026-03-12-links-workshop"]],
    });
    expect(result.entities).toHaveLength(3);
    expect(result.findings).toEqual([]);
  });

  it("reads the plain text of a note and leaves out keyword pages and entities without a note", async () => {
    const { input } = await corpus(twins, twinConfig);
    const parsed = parseSources(input.sources, input.fs);
    const documents = indexDocuments(parsed.documents);
    const typed = typeNotes({ sources: input.sources, documents, config: input.config, profile });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const keyword: Entity = {
      ...(typed.entities[0] as Entity),
      id: "keywords/written-link",
      keyword: true,
    };
    const endpoint: Entity = {
      ...(typed.entities[0] as Entity),
      id: "meetings/api/op",
      source: { name: "meetings", path: "contract.json", line: 1 },
    };
    // A note of a git source carries its commit, which reinforces a pair.
    const committed = typed.entities.map((entity) => ({
      ...entity,
      source: { ...entity.source, commit: "c0ffee" },
    }));
    const result = reconcileTwins({
      entities: [...committed, keyword, endpoint],
      links: [],
      documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
      clock,
    });
    expect(result.counts.resources).toBe(3);
    expect(result.entities.map((entity) => entity.id)).toContain("keywords/written-link");
    expect(result.entities.map((entity) => entity.id)).toContain("meetings/api/op");
  });

  it("names resources by base name and folder whatever the depth and the extension", async () => {
    const { input } = await corpus(
      {
        "/work/meetings/deep/folder/notes.rule.md": "# Notes\n\nText.\n",
        "/work/decks/notes.rule.md": "# Notes\n\nOther text.\n",
        "/work/decks/.hidden.md": "# Hidden\n\nA dot file.\n",
      },
      twinConfig,
    );
    const parsed = parseSources(input.sources, input.fs);
    const documents = indexDocuments(parsed.documents);
    const typed = typeNotes({ sources: input.sources, documents, config: input.config, profile });
    const dictionaries = buildDictionaries({
      entities: typed.entities,
      sources: input.sources,
      config: input.config,
      configDirectory: "/work",
      fs: input.fs,
    });
    const result = reconcileTwins({
      entities: typed.entities,
      links: [],
      documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      config: input.config,
      profile,
      clock,
    });
    expect(result.findings.map((finding) => finding.message)).toEqual([
      expect.stringContaining(
        "decks/notes.rule.md and meetings/deep/folder/notes.rule.md",
      ) as string,
    ]);
    expect(result.counts.resources).toBe(3);
  });
});

describe("model checks over the structural view", () => {
  it("hands the checks the entities, the links with their provenance paths, the files of every source and the profile", async () => {
    const { input } = await corpus(richCorpus);
    const result = await runPipeline(input);
    const seen: unknown[] = [];
    const spy: CheckContribution = {
      id: "W-SPY",
      severity: "info",
      description: "records its input",
      remediation: "none",
      documentation: "https://example.invalid/W-SPY",
      run: (checkInput) => {
        seen.push(checkInput.payload);
        return [];
      },
    };
    runModelChecks({
      registry: createRegistry(catalogue, [spy]),
      entities: result.entities,
      links: result.links,
      sources: input.sources,
      profile,
    });
    expect(seen).toHaveLength(1);
    const payload = seen[0] as {
      entities: { id: string }[];
      links: { provenance: { method: string; path?: string }[] }[];
      sources: { name: string; files: string[] }[];
      profile: Profile;
    };
    expect(payload.entities).toHaveLength(result.entities.length);
    const methods = payload.links.flatMap((link) => link.provenance);
    expect(methods.some((p) => p.method === "explicit_link" && typeof p.path === "string")).toBe(
      true,
    );
    expect(methods.some((p) => p.method === "cooccurrence" && !("path" in p))).toBe(true);
    expect(payload.sources.map((source) => source.files.length)).toEqual([2, 2]);
    expect(payload.profile).toBe(profile);
  });
});
