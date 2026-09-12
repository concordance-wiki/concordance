import { describe, expect, it } from "vitest";

import { apiConsumerMismatch, apiWithoutConsumer } from "../../src/checks/api-consumers.js";
import { filed, input, link } from "../fixtures.js";

const payments = filed("specs/api/payments", "api");
const entry = filed("specs/screens/free-payment-entry", "screen");
const search = filed("specs/screens/member-search", "screen");
const serves = link(payments.id, entry.id, "serves");

describe("W-API-NOCONSUMER", () => {
  it("reports an api with neither a consumers attribute nor a serves link leaving it", () => {
    expect(apiWithoutConsumer(input({ entities: [payments, entry] }))).toEqual([
      {
        check: "W-API-NOCONSUMER",
        severity: "warning",
        message:
          "specs/api/payments has no consumer: no consumers attribute names one and no note cites it",
        remediation: "Declare the consumers, or mention the API in the notes that use it.",
        source: "specs",
        path: "api/payments.md",
        entity: "specs/api/payments",
      },
    ]);
  });

  it("treats an empty consumers attribute as no declared consumer", () => {
    const api = filed(payments.id, "api", { consumers: [] });
    expect(apiWithoutConsumer(input({ entities: [api] })).map((f) => f.entity)).toEqual([api.id]);
  });

  it("accepts a consumer declared in the consumers attribute", () => {
    const api = filed(payments.id, "api", { consumers: [search.id] });
    expect(apiWithoutConsumer(input({ entities: [api] }))).toEqual([]);
  });

  it("accepts a consumer inferred as a serves link leaving the api", () => {
    expect(apiWithoutConsumer(input({ entities: [payments, entry], links: [serves] }))).toEqual([]);
  });

  it("ignores links of another relation and links arriving at the api", () => {
    const links = [
      link(payments.id, entry.id, "related"),
      link(entry.id, payments.id, "serves"),
      link(entry.id, search.id, "serves"),
    ];
    expect(apiWithoutConsumer(input({ entities: [payments, entry], links })).length).toBe(1);
  });

  it("ignores entities that are not apis and non-string consumers", () => {
    const api = filed(payments.id, "api", { consumers: [42] });
    const other = filed(entry.id, "screen", { consumers: "nobody" });
    expect(apiWithoutConsumer(input({ entities: [other, api] })).map((f) => f.entity)).toEqual([
      api.id,
    ]);
  });
});

describe("W-API-CONSUMER-MISMATCH", () => {
  it("reports a declared consumer that never cites the api", () => {
    const api = filed(payments.id, "api", { consumers: [search.id, entry.id] });
    expect(apiConsumerMismatch(input({ entities: [api, entry, search], links: [serves] }))).toEqual(
      [
        {
          check: "W-API-CONSUMER-MISMATCH",
          severity: "warning",
          message:
            "specs/api/payments declares consumer specs/screens/member-search, which never cites it",
          remediation:
            "Reconcile the two notes: remove the stale consumer or add the missing mention.",
          source: "specs",
          path: "api/payments.md",
          entity: "specs/api/payments",
        },
      ],
    );
  });

  it("reports a note citing the api that the consumers attribute does not list", () => {
    const api = filed(payments.id, "api", { consumers: [search.id] });
    const cited = link(payments.id, search.id, "serves");
    expect(apiConsumerMismatch(input({ entities: [api], links: [cited, serves] }))).toEqual([
      {
        check: "W-API-CONSUMER-MISMATCH",
        severity: "warning",
        message:
          "specs/screens/free-payment-entry cites specs/api/payments, which does not list it among its consumers",
        remediation:
          "Reconcile the two notes: remove the stale consumer or add the missing mention.",
        source: "specs",
        path: "api/payments.md",
        entity: "specs/api/payments",
      },
    ]);
  });

  it("reports both directions at once, stale consumers first", () => {
    const api = filed(payments.id, "api", { consumers: [search.id] });
    const messages = apiConsumerMismatch(input({ entities: [api], links: [serves] })).map(
      (f) => f.message,
    );
    expect(messages).toEqual([
      "specs/api/payments declares consumer specs/screens/member-search, which never cites it",
      "specs/screens/free-payment-entry cites specs/api/payments, which does not list it among its consumers",
    ]);
  });

  it("stays silent when the attribute and the links agree", () => {
    const api = filed(payments.id, "api", { consumers: [entry.id] });
    expect(apiConsumerMismatch(input({ entities: [api], links: [serves] }))).toEqual([]);
  });

  it("stays silent when the api declares no consumers attribute, whatever the links", () => {
    expect(apiConsumerMismatch(input({ entities: [payments], links: [serves] }))).toEqual([]);
  });

  it("reports every cited consumer when the attribute is an empty list", () => {
    const api = filed(payments.id, "api", { consumers: [] });
    expect(apiConsumerMismatch(input({ entities: [api], links: [serves] })).length).toBe(1);
  });

  it("ignores entities that are not apis", () => {
    const screen = filed(entry.id, "screen", { consumers: [search.id] });
    expect(apiConsumerMismatch(input({ entities: [screen] }))).toEqual([]);
  });
});
