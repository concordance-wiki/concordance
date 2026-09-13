import { describe, expect, it } from "vitest";

import { apiConsumerMismatch, apiWithoutConsumer } from "../../src/checks/api-consumers.js";
import { filed, input, link } from "../fixtures.js";

const query = filed("specs/api/model-query", "api");
const entry = filed("specs/screens/mentions-panel", "screen");
const search = filed("specs/screens/entity-page", "screen");
const serves = link(query.id, entry.id, "serves");

describe("W-API-NOCONSUMER", () => {
  it("reports an api with neither a consumers attribute nor a serves link leaving it", () => {
    expect(apiWithoutConsumer(input({ entities: [query, entry] }))).toEqual([
      {
        check: "W-API-NOCONSUMER",
        severity: "warning",
        message:
          "specs/api/model-query has no consumer: no consumers attribute names one and no note cites it",
        remediation: "Declare the consumers, or mention the API in the notes that use it.",
        source: "specs",
        path: "api/model-query.md",
        entity: "specs/api/model-query",
      },
    ]);
  });

  it("treats an empty consumers attribute as no declared consumer", () => {
    const api = filed(query.id, "api", { consumers: [] });
    expect(apiWithoutConsumer(input({ entities: [api] })).map((f) => f.entity)).toEqual([api.id]);
  });

  it("accepts a consumer declared in the consumers attribute", () => {
    const api = filed(query.id, "api", { consumers: [search.id] });
    expect(apiWithoutConsumer(input({ entities: [api] }))).toEqual([]);
  });

  it("accepts a consumer inferred as a serves link leaving the api", () => {
    expect(apiWithoutConsumer(input({ entities: [query, entry], links: [serves] }))).toEqual([]);
  });

  it("ignores links of another relation and links arriving at the api", () => {
    const links = [
      link(query.id, entry.id, "related"),
      link(entry.id, query.id, "serves"),
      link(entry.id, search.id, "serves"),
    ];
    expect(apiWithoutConsumer(input({ entities: [query, entry], links }))).toHaveLength(1);
  });

  it("ignores entities that are not apis and non-string consumers", () => {
    const api = filed(query.id, "api", { consumers: [42] });
    const other = filed(entry.id, "screen", { consumers: "nobody" });
    expect(apiWithoutConsumer(input({ entities: [other, api] })).map((f) => f.entity)).toEqual([
      api.id,
    ]);
  });
});

describe("W-API-CONSUMER-MISMATCH", () => {
  it("reports a declared consumer that never cites the api", () => {
    const api = filed(query.id, "api", { consumers: [search.id, entry.id] });
    expect(apiConsumerMismatch(input({ entities: [api, entry, search], links: [serves] }))).toEqual(
      [
        {
          check: "W-API-CONSUMER-MISMATCH",
          severity: "warning",
          message:
            "specs/api/model-query declares consumer specs/screens/entity-page, which never cites it",
          remediation:
            "Reconcile the two notes: remove the stale consumer or add the missing mention.",
          source: "specs",
          path: "api/model-query.md",
          entity: "specs/api/model-query",
        },
      ],
    );
  });

  it("reports a note citing the api that the consumers attribute does not list", () => {
    const api = filed(query.id, "api", { consumers: [search.id] });
    const cited = link(query.id, search.id, "serves");
    expect(apiConsumerMismatch(input({ entities: [api], links: [cited, serves] }))).toEqual([
      {
        check: "W-API-CONSUMER-MISMATCH",
        severity: "warning",
        message:
          "specs/screens/mentions-panel cites specs/api/model-query, which does not list it among its consumers",
        remediation:
          "Reconcile the two notes: remove the stale consumer or add the missing mention.",
        source: "specs",
        path: "api/model-query.md",
        entity: "specs/api/model-query",
      },
    ]);
  });

  it("reports both directions at once, stale consumers first", () => {
    const api = filed(query.id, "api", { consumers: [search.id] });
    const messages = apiConsumerMismatch(input({ entities: [api], links: [serves] })).map(
      (f) => f.message,
    );
    expect(messages).toEqual([
      "specs/api/model-query declares consumer specs/screens/entity-page, which never cites it",
      "specs/screens/mentions-panel cites specs/api/model-query, which does not list it among its consumers",
    ]);
  });

  it("stays silent when the attribute and the links agree", () => {
    const api = filed(query.id, "api", { consumers: [entry.id] });
    expect(apiConsumerMismatch(input({ entities: [api], links: [serves] }))).toEqual([]);
  });

  it("stays silent when the api declares no consumers attribute, whatever the links and the Consumers section", () => {
    const listed = link(query.id, search.id, "serves", [
      { method: "section_mention", path: "api/model-query.md" },
    ]);
    const cited = link(query.id, entry.id, "serves", [
      { method: "explicit_link", path: "screens/mentions-panel.md" },
    ]);
    expect(
      apiConsumerMismatch(input({ entities: [query, entry, search], links: [listed, cited] })),
    ).toEqual([]);
  });

  it("reads the Consumers section of the api note as a declaration, next to the attribute", () => {
    const api = filed(query.id, "api", { consumers: [entry.id] });
    const viewer = filed("specs/screens/document-viewer", "screen");
    const links = [
      // Listed under the section and citing the api from its own note: the two sides agree.
      link(query.id, search.id, "serves", [
        { method: "section_mention", path: "api/model-query.md", line: 12 },
        { method: "explicit_link", path: "screens/entity-page.md", line: 7 },
      ]),
      // Listed under the section, and in the attribute, but never citing: stale once.
      link(query.id, entry.id, "serves", [
        { method: "frontmatter_ref", path: "api/model-query.md", line: 1 },
        { method: "section_mention", path: "api/model-query.md", line: 13 },
      ]),
      // Citing from its own note, listed nowhere: missing.
      link(query.id, viewer.id, "serves", [
        { method: "explicit_link", path: "screens/document-viewer.md", line: 5 },
      ]),
    ];
    const messages = apiConsumerMismatch(
      input({ entities: [api, entry, search, viewer], links }),
    ).map((f) => f.message);
    expect(messages).toEqual([
      "specs/api/model-query declares consumer specs/screens/mentions-panel, which never cites it",
      "specs/screens/document-viewer cites specs/api/model-query, which does not list it among its consumers",
    ]);
  });

  it("reads a prose mention in the api note as neither a declaration nor a citation", () => {
    const api = filed(query.id, "api", { consumers: [] });
    const prose = link(query.id, entry.id, "serves", [
      { method: "glossary_occurrence", path: "api/model-query.md", line: 9 },
    ]);
    expect(apiConsumerMismatch(input({ entities: [api, entry], links: [prose] }))).toEqual([]);
  });

  it("reads a section entry of another note, or of another relation, as no declaration of this api", () => {
    const api = filed(query.id, "api", { consumers: [] });
    const links = [
      link(query.id, entry.id, "serves", [
        { method: "section_mention", path: "screens/entity-page.md" },
      ]),
      link(query.id, search.id, "accesses", [
        { method: "section_mention", path: "api/model-query.md" },
      ]),
      link(entry.id, search.id, "serves", [
        { method: "section_mention", path: "api/model-query.md" },
      ]),
    ];
    const messages = apiConsumerMismatch(input({ entities: [api, entry, search], links })).map(
      (f) => f.message,
    );
    expect(messages).toEqual([
      "specs/screens/mentions-panel cites specs/api/model-query, which does not list it among its consumers",
    ]);
  });

  it("reports every cited consumer when the attribute is an empty list", () => {
    const api = filed(query.id, "api", { consumers: [] });
    expect(apiConsumerMismatch(input({ entities: [api], links: [serves] }))).toHaveLength(1);
  });

  it("ignores entities that are not apis", () => {
    const screen = filed(entry.id, "screen", { consumers: [search.id] });
    expect(apiConsumerMismatch(input({ entities: [screen] }))).toEqual([]);
  });

  it("resolves a consumer written relative to the source of the api note", () => {
    const api = filed(query.id, "api", { consumers: ["screens/mentions-panel"] });
    const cited = link(query.id, entry.id, "serves", [
      { method: "explicit_link", path: "screens/mentions-panel.md" },
    ]);
    expect(apiConsumerMismatch(input({ entities: [api, entry], links: [cited] }))).toEqual([]);
  });

  it("keeps a consumer that names no entity as written and reports it as stale", () => {
    const api = filed(query.id, "api", { consumers: ["screens/gone"] });
    const messages = apiConsumerMismatch(input({ entities: [api, entry] })).map((f) => f.message);
    expect(messages).toEqual([
      "specs/api/model-query declares consumer screens/gone, which never cites it",
    ]);
  });

  it("does not count the api's own consumers attribute or Consumers section as a citation", () => {
    const api = filed(query.id, "api", { consumers: [entry.id] });
    const own = [
      link(query.id, entry.id, "serves", [
        { method: "frontmatter_ref", path: "api/model-query.md" },
        { method: "section_mention", path: "api/model-query.md" },
      ]),
      link(query.id, search.id, "serves", [
        { method: "section_mention", path: "api/model-query.md" },
      ]),
    ];
    const messages = apiConsumerMismatch(input({ entities: [api, entry, search], links: own })).map(
      (f) => f.message,
    );
    expect(messages).toEqual([
      "specs/api/model-query declares consumer specs/screens/mentions-panel, which never cites it",
      "specs/api/model-query declares consumer specs/screens/entity-page, which never cites it",
    ]);
  });

  it("counts a serves link read in the consumer's note as a citation, whatever its other provenances", () => {
    const api = filed(query.id, "api", { consumers: [entry.id] });
    const cited = link(query.id, entry.id, "serves", [
      { method: "frontmatter_ref", path: "api/model-query.md" },
      { method: "explicit_link", path: "screens/mentions-panel.md" },
    ]);
    expect(apiConsumerMismatch(input({ entities: [api, entry], links: [cited] }))).toEqual([]);
  });

  it("ignores a provenance without a path when deciding whether a note cites the api", () => {
    const api = filed(query.id, "api", { consumers: [] });
    const unlocated = link(query.id, entry.id, "serves", [{ method: "cooccurrence" }]);
    expect(apiConsumerMismatch(input({ entities: [api, entry], links: [unlocated] }))).toEqual([]);
  });

  it("still counts the api's own section for W-API-NOCONSUMER: a section is a declaration", () => {
    const own = link(query.id, entry.id, "serves", [
      { method: "section_mention", path: "api/model-query.md" },
    ]);
    expect(apiWithoutConsumer(input({ entities: [query, entry], links: [own] }))).toEqual([]);
  });
});
