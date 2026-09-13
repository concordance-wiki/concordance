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
    expect(apiWithoutConsumer(input({ entities: [query, entry], links })).length).toBe(1);
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

  it("stays silent when the api declares no consumers attribute, whatever the links", () => {
    expect(apiConsumerMismatch(input({ entities: [query], links: [serves] }))).toEqual([]);
  });

  it("reports every cited consumer when the attribute is an empty list", () => {
    const api = filed(query.id, "api", { consumers: [] });
    expect(apiConsumerMismatch(input({ entities: [api], links: [serves] })).length).toBe(1);
  });

  it("ignores entities that are not apis", () => {
    const screen = filed(entry.id, "screen", { consumers: [search.id] });
    expect(apiConsumerMismatch(input({ entities: [screen] }))).toEqual([]);
  });
});
