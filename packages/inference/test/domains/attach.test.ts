import { describe, expect, it } from "vitest";

import { proposeEmergentDomains } from "../../src/domains/attach.js";
import type { DomainEdge, DomainNode } from "../../src/domains/types.js";

const term = (id: string): DomainNode => ({ id, candidate: true, attachable: true });
const note = (id: string): DomainNode => ({ id, candidate: false, attachable: true });
const filed = (id: string): DomainNode => ({ id, candidate: false, attachable: false });
const edge = (a: string, b: string): DomainEdge => ({ a, b });

/**
 * Two glossary terms with their neighbourhoods: the finding, cited by four notes, and the
 * check, cited by two, one of which the finding also cites; a chain leaves the check towards
 * the linter; the theme note sits alone.
 */
const nodes = [
  term("glossary/finding"),
  term("glossary/check"),
  note("specs/objects/finding"),
  note("specs/screens/todo-page"),
  note("specs/rules/fail-on"),
  note("specs/objects/build"),
  note("specs/processes/lint"),
  note("specs/screens/theme"),
  note("specs/roles/maintainer"),
];
const edges = [
  edge("glossary/finding", "specs/objects/finding"),
  edge("glossary/finding", "specs/screens/todo-page"),
  edge("glossary/finding", "specs/rules/fail-on"),
  edge("glossary/finding", "specs/objects/build"),
  edge("glossary/check", "specs/objects/build"),
  edge("glossary/check", "specs/processes/lint"),
  edge("specs/processes/lint", "specs/roles/maintainer"),
];

describe("the emergent domains", () => {
  it("attach every attachable note within the radius to its closest pivot, the pivot itself at zero", () => {
    expect(
      proposeEmergentDomains({ nodes, edges }, { minNeighbours: 2, radius: 1, assign: false }),
    ).toEqual({
      pivots: [
        { id: "glossary/finding", degree: 4 },
        { id: "glossary/check", degree: 2 },
      ],
      attachments: [
        { id: "glossary/check", pivot: "glossary/check", distance: 0 },
        { id: "glossary/finding", pivot: "glossary/finding", distance: 0 },
        { id: "specs/objects/build", pivot: "glossary/finding", distance: 1 },
        { id: "specs/objects/finding", pivot: "glossary/finding", distance: 1 },
        { id: "specs/processes/lint", pivot: "glossary/check", distance: 1 },
        { id: "specs/rules/fail-on", pivot: "glossary/finding", distance: 1 },
        { id: "specs/screens/todo-page", pivot: "glossary/finding", distance: 1 },
      ],
    });
  });

  it("reach further with the radius and leave a note beyond it, or alone, unattached", () => {
    const { attachments } = proposeEmergentDomains(
      { nodes, edges },
      { minNeighbours: 4, radius: 2, assign: false },
    );
    expect(attachments).toEqual([
      { id: "glossary/check", pivot: "glossary/finding", distance: 2 },
      { id: "glossary/finding", pivot: "glossary/finding", distance: 0 },
      { id: "specs/objects/build", pivot: "glossary/finding", distance: 1 },
      { id: "specs/objects/finding", pivot: "glossary/finding", distance: 1 },
      { id: "specs/rules/fail-on", pivot: "glossary/finding", distance: 1 },
      { id: "specs/screens/todo-page", pivot: "glossary/finding", distance: 1 },
    ]);
    const wider = proposeEmergentDomains(
      { nodes, edges },
      { minNeighbours: 4, radius: 3, assign: false },
    );
    expect(wider.attachments.map((attachment) => attachment.id)).toContain("specs/processes/lint");
    expect(wider.attachments.map((attachment) => attachment.id)).not.toContain(
      "specs/screens/theme",
    );
  });

  it("prefer the shorter distance over the larger degree", () => {
    const { attachments } = proposeEmergentDomains(
      { nodes, edges },
      { minNeighbours: 2, radius: 3, assign: false },
    );
    expect(attachments.find((attachment) => attachment.id === "specs/processes/lint")).toEqual({
      id: "specs/processes/lint",
      pivot: "glossary/check",
      distance: 1,
    });
    expect(attachments.find((attachment) => attachment.id === "specs/roles/maintainer")).toEqual({
      id: "specs/roles/maintainer",
      pivot: "glossary/check",
      distance: 2,
    });
  });

  it("break an equal distance by the larger degree, then by the identifier in code-unit order", () => {
    const tied = [
      term("glossary/b"),
      term("glossary/a"),
      term("glossary/Z"),
      note("specs/shared"),
      note("specs/leaf"),
    ];
    const contested = [
      edge("glossary/b", "specs/shared"),
      edge("glossary/a", "specs/shared"),
      edge("glossary/Z", "specs/shared"),
      edge("glossary/b", "specs/leaf"),
    ];
    const { attachments } = proposeEmergentDomains(
      { nodes: tied, edges: contested },
      { minNeighbours: 1, radius: 1, assign: false },
    );
    expect(attachments.find((attachment) => attachment.id === "specs/shared")).toEqual({
      id: "specs/shared",
      pivot: "glossary/b",
      distance: 1,
    });
    const equal = proposeEmergentDomains(
      { nodes: tied, edges: contested.slice(0, 3) },
      { minNeighbours: 1, radius: 1, assign: false },
    );
    expect(equal.attachments.find((attachment) => attachment.id === "specs/shared")).toEqual({
      id: "specs/shared",
      pivot: "glossary/Z",
      distance: 1,
    });
  });

  it("walk through a filed note without attaching it", () => {
    const through = [
      term("glossary/finding"),
      filed("specs/objects/finding"),
      note("specs/objects/build"),
    ];
    const chain = [
      edge("glossary/finding", "specs/objects/finding"),
      edge("specs/objects/finding", "specs/objects/build"),
    ];
    expect(
      proposeEmergentDomains(
        { nodes: through, edges: chain },
        { minNeighbours: 1, radius: 2, assign: true },
      ).attachments,
    ).toEqual([
      { id: "glossary/finding", pivot: "glossary/finding", distance: 0 },
      { id: "specs/objects/build", pivot: "glossary/finding", distance: 2 },
    ]);
  });

  it("give the same result whatever the order of the nodes and the edges", () => {
    const reference = proposeEmergentDomains(
      { nodes, edges },
      { minNeighbours: 2, radius: 3, assign: false },
    );
    const shuffled = proposeEmergentDomains(
      { nodes: [...nodes].reverse(), edges: [...edges].reverse().map(({ a, b }) => edge(b, a)) },
      { minNeighbours: 2, radius: 3, assign: false },
    );
    expect(shuffled).toEqual(reference);
  });

  it("propose nothing without a pivot", () => {
    expect(
      proposeEmergentDomains({ nodes, edges }, { minNeighbours: 5, radius: 3, assign: false }),
    ).toEqual({
      pivots: [],
      attachments: [],
    });
  });
});
