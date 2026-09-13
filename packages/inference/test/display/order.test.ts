import { loadDefaultProfile, resolveProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { displayedNeighbourhood } from "../../src/display/neighbourhood.js";
import type { DisplayedNeighbour } from "../../src/display/types.js";
import { entity, link } from "./fixtures.js";

const profile = loadDefaultProfile();

function shown(neighbours: readonly DisplayedNeighbour[] | undefined): [string, number][] {
  return (neighbours ?? []).map((neighbour) => [neighbour.id, neighbour.rank]);
}

describe("the type-driven neighbour order", () => {
  it("puts the operations first on an API, even at a lower confidence", () => {
    const api = "specs/api/model-query";
    const entities = [
      entity(api, "api"),
      entity(`${api}/list-entities`, "endpoint"),
      entity(`${api}/get-entity`, "endpoint"),
      entity(`${api}/search-model`, "endpoint"),
      entity("specs/screens/search", "screen"),
      entity("specs/objects/entity", "business_object"),
      entity("decisions/static-site-with-islands", "decision"),
      entity("glossary/endpoint", "term"),
    ];
    const links = [
      link("glossary/endpoint", api, 1, "mentions"),
      link("specs/objects/entity", api, 0.95, "related"),
      link(api, "specs/screens/search", 0.9, "serves"),
      link("decisions/static-site-with-islands", api, 0.7, "affects"),
      link(api, `${api}/list-entities`, 0.5, "exposes"),
      link(api, `${api}/get-entity`, 0.5, "exposes"),
      link(api, `${api}/search-model`, 0.45, "exposes"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 12 });
    expect(shown(neighbourhood.get(api))).toEqual([
      [`${api}/get-entity`, 0],
      [`${api}/list-entities`, 0],
      [`${api}/search-model`, 0],
      ["specs/screens/search", 1],
      ["specs/objects/entity", 2],
      ["decisions/static-site-with-islands", 4],
      ["glossary/endpoint", 5],
    ]);
  });

  it("puts the accessed objects first on a screen", () => {
    const screen = "specs/screens/entity-page";
    const entities = [
      entity(screen, "screen"),
      entity("specs/objects/entity", "business_object"),
      entity("specs/data/links", "data_object"),
      entity("specs/screens/keyword-page", "screen"),
      entity("specs/api/model-query", "api"),
      entity("glossary/mention", "term"),
    ];
    const links = [
      link(screen, "glossary/mention", 0.95, "mentions"),
      link(screen, "specs/screens/keyword-page", 0.9, "related"),
      link("specs/api/model-query", screen, 0.8, "serves"),
      link(screen, "specs/objects/entity", 0.6, "accesses"),
      link(screen, "specs/data/links", 0.5, "reads"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(shown(neighbourhood.get(screen))).toEqual([
      ["specs/objects/entity", 0],
      ["specs/data/links", 1],
      ["specs/screens/keyword-page", 2],
      ["specs/api/model-query", 3],
      ["glossary/mention", 6],
    ]);
  });

  it("puts what it applies to first on a rule", () => {
    const rule = "specs/rules/publication-threshold";
    const entities = [
      entity(rule, "rule"),
      entity("specs/screens/keyword-page", "screen"),
      entity("specs/processes/build-pipeline", "process"),
      entity("specs/objects/keyword-page", "business_object"),
      entity("decisions/keyword-page-threshold", "decision"),
      entity("meetings/keyword-page-threshold-review", "meeting"),
      entity("glossary/publication-threshold", "term"),
    ];
    const links = [
      link("glossary/publication-threshold", rule, 1, "mentions"),
      link("decisions/keyword-page-threshold", rule, 0.9, "affects"),
      link("meetings/keyword-page-threshold-review", rule, 0.8, "related"),
      link(rule, "specs/objects/keyword-page", 0.7, "constrains"),
      link(rule, "specs/processes/build-pipeline", 0.7, "constrains"),
      link(rule, "specs/screens/keyword-page", 0.7, "constrains"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 12 });
    expect(shown(neighbourhood.get(rule))).toEqual([
      ["specs/screens/keyword-page", 0],
      ["specs/processes/build-pipeline", 1],
      ["specs/objects/keyword-page", 3],
      ["decisions/keyword-page-threshold", 4],
      ["glossary/publication-threshold", 5],
      ["meetings/keyword-page-threshold-review", 5],
    ]);
  });

  it("shows the best of the priority order, not the most confident, when truncating", () => {
    const api = "specs/api/model-query";
    const operations = Array.from({ length: 7 }, (_, i) => `${api}/operation-${String(i)}`);
    const entities = [
      entity(api, "api"),
      ...operations.map((id) => entity(id, "endpoint")),
      entity("specs/screens/search", "screen"),
    ];
    const links = [
      link(api, "specs/screens/search", 0.9, "serves"),
      ...operations.map((id) => link(api, id, 0.3, "exposes")),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(shown(neighbourhood.get(api))).toEqual(operations.slice(0, 6).map((id) => [id, 0]));
  });

  it("ranks keyword neighbours with the types the order does not list", () => {
    const api = "specs/api/model-query";
    const entities = [
      entity(api, "api"),
      entity(`${api}/list-entities`, "endpoint"),
      entity("words/build-summary", "keyword", true),
      entity("glossary/endpoint", "term"),
    ];
    const links = [
      link("words/build-summary", api, 0.9, "mentions"),
      link("glossary/endpoint", api, 0.8, "mentions"),
      link(api, `${api}/list-entities`, 0.3, "exposes"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(shown(neighbourhood.get(api))).toEqual([
      [`${api}/list-entities`, 0],
      ["words/build-summary", 5],
      ["glossary/endpoint", 5],
    ]);
  });

  it("orders by decreasing confidence then by identifier without a declaration", () => {
    expect(profile.types["domain"]?.display?.neighbours_order).toBeUndefined();
    const domain = "domains/publication";
    const entities = [
      entity(domain, "domain"),
      entity("specs/screens/entity-page", "screen"),
      entity("specs/api/canonical-model", "api"),
      entity("specs/objects/keyword-page", "business_object"),
      entity("words/build-summary", "keyword", true),
      entity("glossary/theme", "term"),
    ];
    const links = [
      link("specs/screens/entity-page", domain, 0.5, "related"),
      link("specs/api/canonical-model", domain, 0.8, "related"),
      link("specs/objects/keyword-page", domain, 0.5, "related"),
      link("words/build-summary", domain, 0.9, "mentions"),
      link("glossary/theme", domain, 0.8, "mentions"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(shown(neighbourhood.get(domain))).toEqual([
      ["words/build-summary", 0],
      ["glossary/theme", 0],
      ["specs/api/canonical-model", 0],
      ["specs/objects/keyword-page", 0],
      ["specs/screens/entity-page", 0],
    ]);
    expect(shown(neighbourhood.get("words/build-summary"))).toEqual([[domain, 0]]);
  });

  it("follows the order of the profile it is given, not a built-in one", () => {
    const resolved = resolveProfile(
      "types:\n  api:\n    display:\n      neighbours_order: [decision, endpoint]\n",
    );
    expect(resolved.ok).toBe(true);
    // Narrowed by the assertion above; a failed resolution would have stopped the test.
    const swapped = (resolved as { ok: true; profile: Profile }).profile;
    const api = "specs/api/model-query";
    const entities = [
      entity(api, "api"),
      entity(`${api}/list-entities`, "endpoint"),
      entity("decisions/static-site-with-islands", "decision"),
      entity("specs/screens/search", "screen"),
    ];
    const links = [
      link(api, `${api}/list-entities`, 0.9, "exposes"),
      link("decisions/static-site-with-islands", api, 0.5, "affects"),
      link(api, "specs/screens/search", 0.7, "serves"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile: swapped, size: 6 });
    expect(shown(neighbourhood.get(api))).toEqual([
      ["decisions/static-site-with-islands", 0],
      [`${api}/list-entities`, 1],
      ["specs/screens/search", 2],
    ]);
  });
});
