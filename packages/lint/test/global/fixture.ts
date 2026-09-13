import {
  fixedClock,
  memoryFileSystem,
  serializeModel,
  type CanonicalModel,
  type Entity,
  type MemoryFileSystem,
  type SourceConfig,
} from "@concordance-wiki/core";
import { vi } from "vitest";

export const root = "/work";

export const MODEL_URL = "https://concordance-wiki.github.io/demo-wiki/model.json";

export const BUILT_AT = "2026-09-10T08:00:00.000Z";

/** The repository under lint is the `specs` source of the published wiki. */
export const specs: SourceConfig = {
  name: "specs",
  path: "./specs",
  rules: [
    { match: { path: "screens/**" }, set: { type: "screen" } },
    { match: { suffix: ".rule.md" }, set: { type: "rule" } },
    { match: { path: "objects/**" }, set: { type: "business_object" } },
  ],
};

export function remoteEntity(
  id: string,
  type: string,
  title: string,
  aliases: string[] = [],
): Entity {
  const [name = "specs", ...rest] = id.split("/");
  return {
    id,
    type,
    title,
    aliases,
    locale: "en",
    domain: "quality",
    status: "valid",
    type_origin: "rule#1",
    graph: "full",
    attributes: {},
    source: { name, path: `${rest.join("/")}.md`, line: 1 },
  };
}

/** The wiki as last published: a glossary and the specs, built with cross-source links off unless said otherwise. */
export function publishedModel(overrides: Partial<CanonicalModel["build"]> = {}): CanonicalModel {
  return {
    version: 1,
    build: {
      tool: "0.4.0",
      at: BUILT_AT,
      profile_hash: "abc123",
      sources: [{ name: "glossary" }, { name: "specs" }],
      cross_source_links: false,
      ...overrides,
    },
    entities: [
      remoteEntity("glossary/finding", "term", "Finding", ["findings"]),
      remoteEntity("glossary/scope", "term", "Scope", ["lint scope"]),
      remoteEntity("specs/objects/finding", "business_object", "Finding"),
      remoteEntity("specs/rules/publication-threshold", "rule", "Publication threshold"),
      remoteEntity("specs/screens/entity-page", "screen", "Entity page"),
      remoteEntity("specs/screens/keyword-page", "screen", "Keyword page", ["word page", " "]),
    ],
    links: [],
    findings: [],
    candidates: { terms: [], duplicates: [] },
  };
}

export function modelText(model: CanonicalModel = publishedModel()): string {
  return serializeModel(model);
}

export interface StubResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

export interface StubFetch {
  fetch: typeof fetch;
  /** One entry per call: the URL and the request headers, so that tests count and inspect requests. */
  calls: { url: string; headers: Record<string, string> }[];
}

/** A `fetch` answering the queued responses in order, then repeating the last one; throws `error` instead when given. */
export function stubFetch(responses: StubResponse[], error?: Error): StubFetch {
  const calls: StubFetch["calls"] = [];
  const queue = [...responses];
  const fetch = vi.fn((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // The linter always passes the URL as a string and a plain header record.
    const url = input as string;
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    if (error !== undefined) return Promise.reject(error);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    const { status = 200, body = "", headers = {} } = next ?? {};
    return Promise.resolve(new Response(status === 304 ? null : body, { status, headers }));
  });
  return { fetch, calls };
}

export const clock = fixedClock("2026-09-12T12:00:00.000Z");

/** The specs repository with one link of every kind, a forbidden reference and a homonym. */
export function repository(extra: Record<string, string> = {}): MemoryFileSystem {
  return memoryFileSystem({
    [`${root}/screens/entity-page.md`]: [
      "---",
      "reads: [specs/objects/finding, glossary/scope]",
      "rules: [specs/rules/publication-threshold]",
      "roles: glossary/finding",
      "---",
      "# Entity page",
      "",
      "Shows the [scope](glossary:scope.md) of a [finding](../../glossary/finding.md).",
      "A [lost term](glossary:gone.md) and a [lost sibling](../../glossary/missing/term.md).",
      "A [diagram](glossary:diagram.png), a [brief](briefs:intro.md), a [site](https://example.invalid/x.md),",
      "the [threshold](../rules/publication-threshold.rule.md), a [far file](../../../elsewhere.md)",
      "and an [empty target](glossary:#top).",
      "",
    ].join("\n"),
    [`${root}/rules/publication-threshold.rule.md`]: "# Publication threshold\n",
    [`${root}/rules/finding.rule.md`]:
      "---\ntitle: Finding\naliases: [findings, Finding]\n---\n# Finding rule\n",
    [`${root}/objects/finding.md`]: "# Finding\n",
    [`${root}/screens/word-page.md`]: "---\naliases: [Keyword page]\n---\n# Word page\n",
    ...extra,
  });
}
