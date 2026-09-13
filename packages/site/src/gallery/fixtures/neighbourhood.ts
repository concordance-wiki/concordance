import type { SlotProps } from "../../slots.js";

export const neighbourhood: SlotProps["Neighbourhood"] = {
  centre: "Keyword page",
  neighbours: [
    {
      id: "glossary/page",
      label: "page",
      href: "../page/",
      typeLabel: "term",
      typeGlyph: "term",
      weight: 12,
      rank: 0,
    },
    {
      id: "specs/screens/mentions-panel",
      label: "Mentions panel",
      href: "../mentions-panel/",
      relation: "displays",
      typeGlyph: "screen",
      weight: 4,
      rank: 2,
    },
  ],
  total: 2,
};

/** Six neighbours of an API note, every kind of node: shapes, an initial, a noteless word, a cut title. */
export const neighbourhoodFull: SlotProps["Neighbourhood"] = {
  centre: "Model query",
  neighbours: [
    {
      id: "specs/api/model-query/list-entities",
      label: "listEntities",
      href: "../list-entities/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 5,
      rank: 0,
    },
    {
      id: "specs/api/model-query/search-model",
      label: "searchModel",
      href: "../search-model/",
      typeLabel: "Endpoint",
      typeGlyph: "endpoint",
      relation: "exposes",
      weight: 3,
      rank: 0,
    },
    {
      id: "specs/screens/search-results",
      label: "Search results",
      href: "../search-results/",
      typeLabel: "Screen",
      typeGlyph: "screen",
      relation: "serves",
      weight: 9,
      rank: 1,
    },
    {
      id: "specs/rules/identifier-pattern",
      label: "Identifier pattern: lowercase, hyphens, one slash",
      href: "../identifier-pattern/",
      typeLabel: "Rule",
      typeGlyph: "rule",
      relation: "governs",
      weight: 2,
      rank: 2,
    },
    {
      id: "specs/roles/integrator",
      label: "integrator",
      href: "../integrator/",
      typeLabel: "Role",
      typeGlyph: "role",
      relation: "uses",
      weight: 4,
      rank: 3,
    },
    {
      id: "keywords/build-summary",
      label: "build summary",
      href: "../build-summary/",
      typeLabel: "Keyword",
      kind: "keyword",
      weight: 7,
      rank: 3,
    },
  ],
  total: 6,
};

/** The same note when the model holds more neighbours than the map may show: the total reads under the map. */
export const neighbourhoodOverflow: SlotProps["Neighbourhood"] = {
  ...neighbourhoodFull,
  total: 14,
};
