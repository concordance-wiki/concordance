import type { Finding, InferenceConfig, Link } from "@concordance-wiki/core";
import { parseMarkdown, type ParsedMarkdown } from "@concordance-wiki/ingest";
import { loadDefaultProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { explicitLinks } from "../../src/explicit/links.js";
import type { LinkableEntity, SourceResource } from "../../src/explicit/types.js";

const profile = loadDefaultProfile();

interface Note {
  source: string;
  path: string;
  type: string;
  text: string;
}

interface Corpus {
  entities: LinkableEntity[];
  resources: SourceResource[];
  documents: Map<string, ParsedMarkdown>;
}

/** Every note is an entity named after its path; extra resources are files without a note. */
function corpus(notes: Note[], extraResources: SourceResource[] = []): Corpus {
  const entities = notes.map((note): LinkableEntity => ({
    id: `${note.source}/${note.path.replace(/\.md$/, "")}`,
    type: note.type,
    title: note.path,
    attributes: {},
    source: { name: note.source, path: note.path },
  }));
  const resources = [
    ...notes.map((note) => ({ source: note.source, path: note.path })),
    ...extraResources,
  ];
  const documents = new Map(
    notes.map((note) => [
      `${note.source}/${note.path}`,
      parseMarkdown(note.text, { path: note.path }),
    ]),
  );
  return { entities, resources, documents };
}

function run(
  input: Corpus,
  inference?: InferenceConfig,
  customProfile: Profile = profile,
): { links: Link[]; findings: Finding[] } {
  return explicitLinks({ ...input, profile: customProfile, ...(inference ? { inference } : {}) });
}

const screen: Note = {
  source: "specs",
  path: "screens/entry.md",
  type: "screen",
  text: "# Entry\n\nChecked against the [related cap](../rules/cap.rule.md).\n",
};

const rule: Note = {
  source: "specs",
  path: "rules/cap.rule.md",
  type: "rule",
  text: "# Related cap\n",
};

describe("explicitLinks", () => {
  it("every markdown link resolved to a note yields a link at confidence 1.00, method explicit_link", () => {
    const { links, findings } = run(corpus([screen, rule]));
    expect(findings).toEqual([]);
    expect(links).toStrictEqual([
      {
        from: "specs/screens/entry",
        to: "specs/rules/cap.rule",
        relation: "related",
        attributes: {},
        confidence: 1,
        provenance: [
          {
            method: "explicit_link",
            confidence: 1,
            path: "screens/entry.md",
            line: 3,
            text: "related cap",
          },
        ],
      },
    ]);
  });

  it("the provenance records the file, the line and the link text", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\nSee the rule.\n\n## Rules\n\n- The [cap on links](../rules/cap.rule.md)\n",
    };
    const { links } = run(corpus([note, rule]));
    expect(links[0]?.provenance).toEqual([
      {
        method: "explicit_link",
        confidence: 1,
        path: "screens/entry.md",
        line: 7,
        text: "cap on links",
      },
    ]);
  });

  it("reads the confidence of explicit_link from the profile and falls back to 1 without it", () => {
    const scaled: Profile = {
      ...profile,
      confidence: { ...profile.confidence, explicit_link: 0.9 },
    };
    expect(run(corpus([screen, rule]), undefined, scaled).links[0]).toMatchObject({
      confidence: 0.9,
      provenance: [{ confidence: 0.9 }],
    });
    const rest = { ...profile.confidence };
    delete rest.explicit_link;
    const unscaled: Profile = { ...profile, confidence: rest };
    expect(run(corpus([screen, rule]), undefined, unscaled).links[0]).toMatchObject({
      confidence: 1,
      provenance: [{ confidence: 1 }],
    });
  });

  it("a link to a missing file yields an E-LINK-BROKEN finding and no link in the model", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\nSee the [cap](../rules/anual-cap.rule.md).\n",
    };
    const { links, findings } = run(corpus([note, rule]));
    expect(links).toEqual([]);
    expect(findings).toEqual([
      {
        check: "E-LINK-BROKEN",
        severity: "error",
        source: "specs",
        path: "screens/entry.md",
        line: 3,
        entity: "specs/screens/entry",
        message:
          'link "../rules/anual-cap.rule.md" in screens/entry.md points to no file of source specs',
        remediation:
          "Fix the path; the linter rewrites the link under --fix when exactly one file matches the old name.",
      },
    ]);
  });

  it("a link to an existing non-markdown file yields a documents relation from the resource to the note", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\nMock-up in the [screen deck](../decks/Entry%20Screens.pptx).\n",
    };
    const { links, findings } = run(
      corpus([note], [{ source: "specs", path: "decks/Entry Screens.pptx" }]),
    );
    expect(findings).toEqual([]);
    expect(links).toStrictEqual([
      {
        from: "specs/decks/entry-screens",
        to: "specs/screens/entry",
        relation: "documents",
        attributes: {},
        confidence: 1,
        provenance: [
          {
            method: "explicit_link",
            confidence: 1,
            path: "screens/entry.md",
            line: 3,
            text: "screen deck",
          },
        ],
      },
    ]);
  });

  it("ignores external links, links to markdown files without an entity and links to the note itself", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\n[Forge](https://forge.example/x), [notes](../notes.md), [top](#entry), [self](entry.md).\n",
    };
    const { links, findings } = run(corpus([note], [{ source: "specs", path: "notes.md" }]));
    expect(links).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("skips the links of a document that has no entity", () => {
    const built = corpus([screen, rule]);
    const { links } = run({ ...built, entities: built.entities.slice(1) });
    expect(links).toEqual([]);
  });

  it("reports every link of a note whose source has no resource as broken", () => {
    const built = corpus([screen, rule]);
    const { links, findings } = run({ ...built, resources: [] });
    expect(links).toEqual([]);
    expect(findings.map((finding) => finding.check)).toEqual(["E-LINK-BROKEN"]);
  });

  it("merges two links from the same note to the same target into one link with two provenances", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\nChecked against the [related cap](../rules/cap.rule.md).\n\n## Rules\n\n- [Related cap](../rules/cap.rule.md#scope)\n",
    };
    const { links } = run(corpus([note, rule]));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      confidence: 1,
      provenance: [
        { line: 3, text: "related cap" },
        { line: 7, text: "Related cap", anchor: "scope" },
      ],
    });
  });

  it("keeps the anchor of a link in its provenance while the text stays as written", () => {
    const note: Note = {
      ...screen,
      text: "# Entry\n\nSee [the cap's scope](../rules/cap.rule.md#scope).\n",
    };
    const { links } = run(corpus([note, rule]));
    expect(links[0]?.provenance).toEqual([
      {
        method: "explicit_link",
        confidence: 1,
        path: "screens/entry.md",
        line: 3,
        text: "the cap's scope",
        anchor: "scope",
      },
    ]);
  });

  it("leaves every link between two notes as related, whatever their types, for the relation typing step to name", () => {
    const object: Note = {
      source: "specs",
      path: "objects/link.md",
      type: "business_object",
      text: "# Link\n",
    };
    const note: Note = {
      ...screen,
      text: "# Entry\n\nWrites a [link](../objects/link.md) under the [cap](../rules/cap.rule.md).\n",
    };
    const { links } = run(corpus([note, object, rule]));
    expect(links.map((link) => [link.to, link.relation])).toEqual([
      ["specs/objects/link", "related"],
      ["specs/rules/cap.rule", "related"],
    ]);
  });

  it("orders the provenances of one link by path when two notes share its identifier", () => {
    const built = corpus([
      { source: "specs", path: "b.md", type: "screen", text: "# B\n\n[cap](rules/cap.rule.md)\n" },
      { source: "specs", path: "a.md", type: "screen", text: "# A\n\n[cap](rules/cap.rule.md)\n" },
      rule,
    ]);
    const shared = built.entities.map((entity) =>
      entity.type === "screen" ? { ...entity, id: "specs/duplicate" } : entity,
    );
    const { links } = run({ ...built, entities: shared });
    expect(links.map((link) => link.from)).toEqual(["specs/duplicate"]);
    expect(links[0]?.provenance.map((provenance) => provenance.path)).toEqual(["a.md", "b.md"]);
  });

  it("orders links by from, to and relation and provenances by path and line whatever the document order", () => {
    const a: Note = {
      source: "specs",
      path: "b.md",
      type: "screen",
      text: "# B\n\n[a](a.md) then [z](z.md) then [a again](a.md).\n",
    };
    const b: Note = { source: "specs", path: "a.md", type: "screen", text: "# A\n\n[b](b.md)\n" };
    const z: Note = { source: "specs", path: "z.md", type: "screen", text: "# Z\n" };
    const { links } = run(corpus([z, a, b]));
    expect(links.map((link) => [link.from, link.to])).toEqual([
      ["specs/a", "specs/b"],
      ["specs/b", "specs/a"],
      ["specs/b", "specs/z"],
    ]);
    expect(links[1]?.provenance.map((provenance) => provenance.text)).toEqual(["a", "a again"]);
  });

  describe("cross-source links", () => {
    const meeting: Note = {
      source: "meetings",
      path: "2026-03-12-workshop.md",
      type: "meeting",
      text: "# Workshop\n\nSee [the decision](decisions:cap-server-side.md#why).\n",
    };
    const decision: Note = {
      source: "decisions",
      path: "cap-server-side.md",
      type: "decision",
      text: "# Cap checked server-side\n",
    };

    it("cross-source links are resolved when the configuration allows it", () => {
      const { links, findings } = run(corpus([meeting, decision]), { cross_source_links: true });
      expect(findings).toEqual([]);
      expect(links).toEqual([
        {
          from: "meetings/2026-03-12-workshop",
          to: "decisions/cap-server-side",
          relation: "related",
          attributes: {},
          confidence: 1,
          provenance: [
            {
              method: "explicit_link",
              confidence: 1,
              path: "2026-03-12-workshop.md",
              line: 3,
              text: "the decision",
              anchor: "why",
            },
          ],
        },
      ]);
    });

    it("cross-source links are flagged W-LINK-CROSS-SOURCE and produce no link when the configuration forbids them", () => {
      const { links, findings } = run(corpus([meeting, decision]), { cross_source_links: false });
      expect(links).toEqual([]);
      expect(findings).toStrictEqual([
        {
          check: "W-LINK-CROSS-SOURCE",
          severity: "warning",
          source: "meetings",
          path: "2026-03-12-workshop.md",
          line: 3,
          entity: "meetings/2026-03-12-workshop",
          message:
            'link "decisions:cap-server-side.md#why" in 2026-03-12-workshop.md leaves source meetings for source decisions; cross-source links are disabled',
          remediation:
            "Set inference.cross_source_links to true in concordance.yaml to resolve links across sources, or link to a note of the same source.",
        },
      ]);
    });

    it("forbids cross-source links by default", () => {
      expect(run(corpus([meeting, decision])).findings.map((finding) => finding.check)).toEqual([
        "W-LINK-CROSS-SOURCE",
      ]);
    });

    it("reports a prefixed link to a missing file of the other source as broken", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\n[gone](decisions:gone.md) and [nothing](decisions:).\n",
      };
      const { links, findings } = run(corpus([note, decision]), { cross_source_links: true });
      expect(links).toEqual([]);
      expect(findings.map((finding) => [finding.check, finding.line])).toEqual([
        ["E-LINK-BROKEN", 3],
        ["E-LINK-BROKEN", 3],
      ]);
    });

    it("leaves a prefix that names no source to the URL schemes", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\n[mail](mailto:someone@example.test)\n",
      };
      const { links, findings } = run(corpus([note, decision]), { cross_source_links: true });
      expect(links).toEqual([]);
      expect(findings).toEqual([]);
    });

    it("resolves a relative link that climbs into a sibling source when allowed", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\nSee [the decision](../decisions/cap-server-side.md#why).\n",
      };
      const { links, findings } = run(corpus([note, decision]), { cross_source_links: true });
      expect(findings).toEqual([]);
      expect(links.map((link) => [link.from, link.to, link.relation])).toEqual([
        ["meetings/2026-03-12-workshop", "decisions/cap-server-side", "related"],
      ]);
      expect(links[0]?.provenance[0]?.anchor).toBe("why");
    });

    it("flags a relative link that climbs into a sibling source when forbidden, findings sorted by check", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\nSee [the decision](../decisions/cap-server-side.md) and [gone](gone.md).\n",
      };
      const { links, findings } = run(corpus([note, decision]));
      expect(links).toEqual([]);
      expect(findings.map((finding) => finding.check)).toEqual([
        "E-LINK-BROKEN",
        "W-LINK-CROSS-SOURCE",
      ]);
      expect(findings[1]?.message).toContain("leaves source meetings for source decisions");
    });

    it("never takes a folder named like a source inside the note's own source for that source", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\n[nested](sub/decisions/cap-server-side.md)\n",
      };
      const { links, findings } = run(corpus([note, decision]), { cross_source_links: true });
      expect(links).toEqual([]);
      expect(findings.map((finding) => finding.check)).toEqual(["E-LINK-BROKEN"]);
    });

    it("reports a relative link climbing above the root as broken when it lands in no sibling source", () => {
      const note: Note = {
        ...meeting,
        text: "# Workshop\n\n[up](..), [unknown](../unknown/x.md), [folder](../decisions), [gone](../decisions/gone.md).\n",
      };
      const { links, findings } = run(corpus([note, decision]), { cross_source_links: true });
      expect(links).toEqual([]);
      expect(findings.map((finding) => finding.check)).toEqual([
        "E-LINK-BROKEN",
        "E-LINK-BROKEN",
        "E-LINK-BROKEN",
        "E-LINK-BROKEN",
      ]);
    });
  });
});
