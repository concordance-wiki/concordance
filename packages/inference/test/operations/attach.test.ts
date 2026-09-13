import {
  fixedClock,
  memoryFileSystem,
  type Config,
  type Entity,
  type GitClient,
  type Link,
} from "@concordance-wiki/core";
import {
  ingestSources,
  readMarkdown,
  scannableText,
  type ParsedMarkdown,
} from "@concordance-wiki/ingest";
import {
  buildDictionary,
  dictionaryStopwords,
  glossarySources,
  languagePack,
  scanDocument,
  type Occurrence,
} from "@concordance-wiki/nlp";
import { loadContracts } from "@concordance-wiki/plugin-contract-openapi";
import { typeSources } from "@concordance-wiki/typing";
import { describe, expect, it } from "vitest";

import { explicitLinks } from "../../src/explicit/links.js";
import { frontmatterLinks } from "../../src/frontmatter/links.js";
import { mentionLinks } from "../../src/mentions/links.js";
import { attachOperations, OPERATION_AMBIGUOUS } from "../../src/operations/index.js";
import { typeRelations } from "../../src/relations/index.js";
import {
  CONTRACT,
  WSDL,
  api,
  exposes,
  normalize,
  note,
  operation,
  profile,
  soapOperation,
} from "./fixtures.js";

const modelQuery = api();
const forgeBridge = api("specs/api/forge-bridge", {
  title: "Forge bridge API",
  attributes: { contract: WSDL, protocol: "soap" },
});
const listEntities = operation("listEntities", { path: "/entities" });
const getEntity = operation("getEntity", { path: "/entities/{id}" });
const searchModel = operation("searchModel", { path: "/search" });
const notifyBuild = soapOperation("notifyBuild");
const fetchFindings = soapOperation("fetchFindings");
const operations = [listEntities, getEntity, searchModel, notifyBuild, fetchFindings];
const exposed = operations.map((imported) => exposes(imported));

function attach(entities: Entity[], links: Link[] = exposed) {
  return attachOperations({ entities, links, profile, normalize });
}

function attachments(entities: Entity[]): [string, string | undefined, string | undefined][] {
  return entities
    .filter((entity) => entity.type === "endpoint")
    .map((entity) => [
      entity.id,
      entity.grouped_by,
      entity.representations?.find((representation) => representation.kind === "contract")
        ?.operation,
    ]);
}

describe("attachOperations", () => {
  it("matches on the operation identifier declared in frontmatter, then on the method and path pair, then on the normalised title", () => {
    const notes = [
      note("specs/endpoints/list-entities", {
        title: "List the entities",
        attributes: {
          api: "api/model-query",
          operation_id: "listEntities",
          method: "GET",
          path: "/search",
        },
      }),
      note("specs/endpoints/get-entity", {
        title: "Read an entity",
        attributes: { api: "api/model-query", method: "get", path: "/entities/{id}" },
      }),
      note("specs/endpoints/search-model", {
        title: "Search model",
        attributes: { api: "api/model-query" },
      }),
      note("specs/endpoints/notify-build", {
        title: "Notify build",
        attributes: { port: "ForgeBridgePort" },
      }),
      note("specs/endpoints/fetch-findings", { title: "fetchFindings (ForgeBridgePort)" }),
      note("specs/endpoints/read-model", {
        title: "Read the model",
        attributes: { method: "GET", path: "/model.json" },
      }),
    ];
    const result = attach([modelQuery, forgeBridge, ...notes, ...operations]);
    expect(attachments(result.entities)).toEqual([
      ["specs/endpoints/fetch-findings", "title", "fetchFindings"],
      ["specs/endpoints/get-entity", "method_path", "getEntity"],
      ["specs/endpoints/list-entities", "operation_id", "listEntities"],
      ["specs/endpoints/notify-build", "method_path", "notifyBuild"],
      ["specs/endpoints/read-model", undefined, undefined],
      ["specs/endpoints/search-model", "title", "searchModel"],
    ]);
    expect(result.findings).toEqual([]);
  });

  it("a matched operation shows its note's markdown and its own declared properties", () => {
    const written = note("specs/endpoints/list-entities", {
      title: "List the entities",
      summary: "Returns the entities of the last build.",
      attributes: { api: "api/model-query", operation_id: "listEntities", method: "get" },
    });
    const result = attach([modelQuery, written, listEntities], [exposes(listEntities)]);
    expect(result.entities.map((entity) => entity.id)).toEqual([
      "specs/api/model-query",
      "specs/endpoints/list-entities",
    ]);
    const [, merged] = result.entities;
    expect(merged).toEqual({
      ...written,
      aliases: ["listEntities"],
      attributes: {
        api: "api/model-query",
        method: "get",
        operation_id: "listEntities",
        path: "/entities",
        style: "http",
        summary: "Summary of listEntities",
        tags: [],
      },
      representations: [
        { path: "endpoints/list-entities.md", format: "markdown" },
        { path: CONTRACT, format: "json", kind: "contract", operation: "listEntities" },
      ],
      grouped_by: "operation_id",
    });
    expect(result.links).toEqual([
      {
        from: "specs/api/model-query",
        to: "specs/endpoints/list-entities",
        relation: "exposes",
        confidence: 0.95,
        provenance: [
          {
            method: "contract_import",
            confidence: 0.95,
            path: CONTRACT,
            operation: "listEntities",
          },
        ],
      },
    ]);
  });

  it("an ambiguous match (two candidate notes) yields a finding and no attachment", () => {
    const first = note("specs/endpoints/list-entities", {
      attributes: { api: "api/model-query", operation_id: "listEntities" },
    });
    const second = note("specs/endpoints/entities", {
      attributes: { api: "api/model-query", operation_id: "listEntities" },
    });
    const hesitant = note("specs/endpoints/notify", { title: "notifyBuild" });
    const twin = operation("notifyBuild", { path: "/notify" });
    const result = attach(
      [modelQuery, forgeBridge, first, second, hesitant, listEntities, notifyBuild, twin],
      [...exposed, exposes(twin)],
    );
    expect(result.entities.map((entity) => entity.id)).toEqual([
      "specs/api/forge-bridge",
      "specs/api/forge-bridge/notifybuild",
      "specs/api/model-query",
      "specs/api/model-query/listentities",
      "specs/api/model-query/notifybuild",
      "specs/endpoints/entities",
      "specs/endpoints/list-entities",
      "specs/endpoints/notify",
    ]);
    expect(result.entities.some((entity) => entity.grouped_by !== undefined)).toBe(false);
    expect(result.links).toEqual(
      [...exposed, exposes(twin)].sort((a, b) => a.to.localeCompare(b.to)),
    );
    expect(OPERATION_AMBIGUOUS).toBe("W-OPERATION-AMBIGUOUS");
    expect(result.findings).toEqual([
      {
        check: "W-OPERATION-AMBIGUOUS",
        severity: "warning",
        message:
          "operation specs/api/model-query/listentities of specs/api/model-query is claimed by 2 notes on the operation identifier: specs/endpoints/entities, specs/endpoints/list-entities; none is attached",
        remediation:
          "Give each operation note the operation_id of exactly one operation of its API, name the API in the api attribute when the source declares several contracts, or remove the note that duplicates another.",
        source: "specs",
        path: CONTRACT,
        entity: "specs/api/model-query/listentities",
      },
      {
        check: "W-OPERATION-AMBIGUOUS",
        severity: "warning",
        message:
          "operation note specs/endpoints/notify matches 2 operations on the title: specs/api/forge-bridge/notifybuild, specs/api/model-query/notifybuild; none is attached",
        remediation:
          "Give each operation note the operation_id of exactly one operation of its API, name the API in the api attribute when the source declares several contracts, or remove the note that duplicates another.",
        source: "specs",
        path: "endpoints/notify.md",
        line: 1,
        entity: "specs/endpoints/notify",
      },
    ]);
  });

  it("names the method and path rung in the finding, trims the declared values and sorts the findings by path", () => {
    const first = note("specs/endpoints/b-search", {
      attributes: { api: "api/model-query", method: " get ", path: " /search " },
    });
    const second = note("specs/endpoints/c-search", {
      attributes: { api: "api/model-query", method: "GET", path: "/search" },
    });
    const third = note("specs/endpoints/a-list", {
      attributes: { api: "api/model-query", operation_id: " listEntities " },
    });
    const result = attach(
      [modelQuery, first, second, third, searchModel, listEntities],
      [exposes(searchModel), exposes(listEntities)],
    );
    expect(attachments(result.entities)).toEqual([
      ["specs/api/model-query/searchmodel", undefined, undefined],
      ["specs/endpoints/a-list", "operation_id", "listEntities"],
      ["specs/endpoints/b-search", undefined, undefined],
      ["specs/endpoints/c-search", undefined, undefined],
    ]);
    expect(result.findings.map((finding) => finding.message)).toEqual([
      "operation specs/api/model-query/searchmodel of specs/api/model-query is claimed by 2 notes on the method and path: specs/endpoints/b-search, specs/endpoints/c-search; none is attached",
    ]);
  });

  it("gives the same canonical output whatever the order of the entities and links", () => {
    const notes = [
      note("specs/endpoints/get-entity", { attributes: { method: "GET", path: "/entities/{id}" } }),
      note("specs/endpoints/list-entities", { attributes: { operation_id: "listEntities" } }),
    ];
    const entities = [modelQuery, ...notes, ...operations];
    const forward = attach(entities);
    const backward = attach([...entities].reverse(), [...exposed].reverse());
    expect(backward).toEqual(forward);
    expect(forward.entities.map((entity) => entity.id)).toEqual(
      [...forward.entities.map((entity) => entity.id)].sort(),
    );
  });

  it("leaves a model without imported operations or without notes untouched", () => {
    const written = note("specs/endpoints/list-entities");
    expect(attach([modelQuery, written], [])).toEqual({
      entities: [modelQuery, written],
      links: [],
      findings: [],
    });
    expect(attach([modelQuery, listEntities], [exposes(listEntities)]).entities).toEqual([
      modelQuery,
      listEntities,
    ]);
  });
});

const noGit: GitClient = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

const ROOT = "/wiki";

const corpus: Record<string, string> = {
  "specs/api/model-query.md": `---
protocol: rest
contract: contracts/model-query.openapi.json
---
# Model query API

Serves the canonical model over HTTP.
`,
  "specs/api/contracts/model-query.openapi.json": JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Model query API", version: "0.1.0" },
    paths: {
      "/entities": {
        get: {
          operationId: "listEntities",
          summary: "List the entities of the model",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  }),
  "specs/endpoints/list-entities.md": `---
api: api/model-query
operation_id: listEntities
---
# List the entities

Returns the [entities](../objects/entity.md) of the last build, in identifier order.

## Consumers

- [Pinned trail](../screens/pinned-trail.md)

## Rules

- [Identifier pattern](../rules/identifier-pattern.rule.md)
`,
  "specs/objects/entity.md": "# Entity\n\nOne node of the canonical model.\n",
  "specs/rules/identifier-pattern.rule.md":
    "# Identifier pattern\n\nLowercase, hyphens, at least one slash.\n",
  "specs/screens/pinned-trail.md": "# Pinned trail\n\nThe entities a reader pinned.\n",
};

const config: Config = {
  version: 1,
  project: { name: "Operation notes", locale: "en" },
  applications: [{ id: "concordance-service", title: "Concordance service", status: "target" }],
  domains: [{ id: "publication", title: "Publication", match: ["**"] }],
  sources: [
    {
      name: "specs",
      path: "./specs",
      application: "concordance-service",
      rules: [
        { match: { path: "api/**" }, set: { type: "api" } },
        { match: { path: "endpoints/**" }, set: { type: "endpoint" } },
        { match: { path: "objects/**" }, set: { type: "business_object" } },
        { match: { path: "screens/**" }, set: { type: "screen" } },
        { match: { suffix: ".rule.md" }, set: { type: "rule" } },
      ],
    },
  ],
};

/** Ingest, parse, type, import the contract, attach, then run the link steps the way the pipeline will. */
async function runChain(): Promise<{ entities: Entity[]; links: Link[]; findings: string[] }> {
  const fs = memoryFileSystem(
    Object.fromEntries(
      Object.entries(corpus).map(([path, content]) => [`${ROOT}/${path}`, content]),
    ),
  );
  const ingested = await ingestSources(config, {
    fs,
    git: noGit,
    cacheDirectory: `${ROOT}/.cache`,
    configDirectory: ROOT,
  });
  const documents = new Map<string, ParsedMarkdown>();
  for (const source of ingested.sources) {
    for (const file of source.files) {
      if (!file.path.endsWith(".md")) continue;
      const read = readMarkdown({ fs }, file.absolutePath, file.path);
      if (read.ok) documents.set(`${source.name}/${file.path}`, read.document);
    }
  }
  const typed = typeSources({ sources: ingested.sources, documents, config, profile });
  const contracts = await loadContracts({
    payload: {
      entities: typed.entities,
      roots: { specs: `${ROOT}/specs` },
      cacheDirectory: `${ROOT}/.cache`,
      confidence: { contract_import: 0.95 },
    },
    context: { fs, clock: fixedClock("2026-09-12T10:00:00Z") },
  });
  const attached = attachOperations({
    entities: [...typed.entities, ...contracts.entities],
    links: contracts.links,
    profile,
    normalize: languagePack("en").normalize,
  });
  const { entities } = attached;
  const declared = frontmatterLinks({ entities, profile });
  const written = explicitLinks({
    entities,
    resources: ingested.sources.flatMap((source) =>
      source.files.map((file) => ({ source: source.name, path: file.path })),
    ),
    documents,
    profile,
  });
  const dictionary = buildDictionary({
    entities: entities.map((entity) => ({ ...entity, source: entity.source.name })),
    locale: "en",
    glossarySources: glossarySources(config),
    stopwords: dictionaryStopwords({ locale: "en", config, configDirectory: ROOT, fs }),
    shortTerms: new Set(),
  });
  const scale = profile.confidence.glossary_occurrence;
  if (scale === undefined) throw new Error("the default profile scales glossary occurrences");
  const occurrences: Occurrence[] = entities.flatMap((entity) => {
    const document = documents.get(`${entity.source.name}/${entity.source.path}`);
    if (document === undefined) throw new Error(`${entity.id} was parsed`);
    return scanDocument({
      document: { path: entity.source.path, paragraphs: scannableText(document) },
      source: entity.source.name,
      dictionary,
      pack: languagePack("en"),
      typePrefixes: profile.type_prefixes?.["en"] ?? {},
      scale: {
        base: scale.base,
        per_occurrence: scale.per_occurrence,
        cap: scale.cap,
        homonym_factor: scale.homonym_factor ?? 0.5,
        type_prefix_bonus: scale.type_prefix_bonus ?? 0.1,
      },
    });
  });
  const mentioned = mentionLinks({ occurrences, entities, profile });
  // The written links are named by the relation typing step, like anywhere else.
  const typedLinks = typeRelations({ links: written.links, entities, profile });
  return {
    entities,
    links: [...attached.links, ...declared.links, ...typedLinks.links, ...mentioned.links],
    findings: [
      ...ingested.findings,
      ...typed.findings,
      ...contracts.findings,
      ...attached.findings,
      ...declared.findings,
      ...written.findings,
    ].map((finding) => finding.check),
  };
}

function edges(links: Link[], predicate: (link: Link) => boolean): string[] {
  return links
    .filter(predicate)
    .map(
      (link) =>
        `${link.from} -${link.relation}-> ${link.to} (${[...new Set(link.provenance.map((p) => p.method))].join(",")})`,
    )
    .sort();
}

describe("an operation note through the real chain", () => {
  it("an operation note carries its own links: consumers, applied rules, handled objects", async () => {
    const { entities, links, findings } = await runChain();
    expect(findings).toEqual([]);
    expect(entities.map((entity) => entity.id)).toEqual([
      "specs/api/model-query",
      "specs/endpoints/list-entities",
      "specs/objects/entity",
      "specs/rules/identifier-pattern",
      "specs/screens/pinned-trail",
    ]);
    const merged = entities.find((entity) => entity.id === "specs/endpoints/list-entities");
    expect(merged?.grouped_by).toBe("operation_id");
    expect(merged?.attributes).toEqual({
      api: "api/model-query",
      method: "GET",
      operation_id: "listEntities",
      path: "/entities",
      style: "http",
      summary: "List the entities of the model",
      tags: [],
    });
    const touching = (link: Link): boolean =>
      link.from === "specs/endpoints/list-entities" || link.to === "specs/endpoints/list-entities";
    expect(
      edges(links, (link) => touching(link) && link.provenance[0]?.method !== "explicit_link"),
    ).toEqual([
      "specs/api/model-query -exposes-> specs/endpoints/list-entities (contract_import)",
      "specs/endpoints/list-entities -related-> specs/objects/entity (glossary_occurrence)",
      "specs/endpoints/list-entities -serves-> specs/screens/pinned-trail (section_mention)",
      "specs/rules/identifier-pattern -constrains-> specs/endpoints/list-entities (section_mention)",
    ]);
  });

  it("links written in an operation's markdown are processed like anywhere else", async () => {
    const { links } = await runChain();
    expect(edges(links, (link) => link.provenance[0]?.method === "explicit_link")).toEqual([
      "specs/endpoints/list-entities -accesses-> specs/objects/entity (explicit_link)",
      "specs/endpoints/list-entities -serves-> specs/screens/pinned-trail (explicit_link)",
      "specs/rules/identifier-pattern -constrains-> specs/endpoints/list-entities (explicit_link)",
    ]);
  });
});
