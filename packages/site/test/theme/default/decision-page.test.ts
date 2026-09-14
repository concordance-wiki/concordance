import { describe, expect, it } from "vitest";

import { corporateDecisionPage } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { DecisionProps, EntityPageProps } from "../../../src/slots.js";
import {
  decisionKeyCount,
  defaultDecisionLabels,
} from "../../../src/theme/default/decision-page.js";
import { EntityPage } from "../../../src/theme/default/index.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

// The gallery fixture carries a decision, asserted by the first test: the state of the page that the tests vary.
const fixture = corporateDecisionPage as EntityPageProps & { decision: DecisionProps };

type DecisionPageProps = EntityPageProps & { decision: DecisionProps };

/** Renders the fixture, a copy of it adjusted by the test first. */
function render(adjust: (props: DecisionPageProps) => void = () => undefined): string {
  const props: DecisionPageProps = { ...fixture, decision: { ...fixture.decision } };
  adjust(props);
  return renderSlot("EntityPage", props, defaultTheme);
}

/** Asserts that the markers appear in the markup in the order given, each of them present. */
function expectInOrder(html: string, markers: string[]): void {
  const positions = markers.map((marker) => {
    const at = html.indexOf(marker);
    expect(at, marker).toBeGreaterThanOrEqual(0);
    return at;
  });
  expect(positions).toEqual(positions.slice().sort((a, b) => a - b));
}

const session = {
  label: "Suggestion arbitration",
  href: "../../meetings/2026-05-14-suggestion-arbitration/",
};

describe("DecisionPage", () => {
  it("is what the default theme renders for a view model that carries a decision, the generic template otherwise", () => {
    expect(render()).toContain('<div class="entity entity-with-space decision">');
    const { decision, ...generic } = fixture;
    expect(decision).toBeDefined();
    expect(renderSlot("EntityPage", generic, defaultTheme)).toContain(
      '<div class="entity entity-with-space">',
    );
    expect(EntityPage).toBe(defaultTheme.components.EntityPage);
  });

  it("lays the page out on the shell of the entity page: the tree by year, the breadcrumb naming the year, the title, the chip, the note, the callout, the file, then the panel", () => {
    const html = render();
    expectInOrder(html, [
      '<nav class="space" aria-label="Tree of the space">',
      '<li class="space-folder space-open"><a class="space-folder-name" href="../2026/">2026<span class="count">7</span></a>',
      '<li class="space-page"><a href="../minhash-for-twin-resources/">Minhash for twin resources</a></li>',
      '<li class="space-page space-current"><span aria-current="page">Suggestions in service planned</span></li>',
      '<li><a href="../../#home-tree">decisions</a></li><li><a href="../2026/">2026</a></li><li><span aria-current="page">Suggestions in service planned</span></li>',
      "<h1>Suggestions in service planned</h1>",
      '<p class="entity-badge">',
      '<section id="context"><h2>Context</h2>',
      '<section id="decision"><h2>Decision</h2>',
      '<section id="consequences"><h2>Consequences</h2>',
      '<aside class="decision-session" role="note">',
      '<footer class="entity-footer">',
      '<code><span class="entity-source-folders">decisions/</span>suggestions-in-service-planned.md</code>',
      '<div class="entity-side">',
      '<section class="panel-block entity-panel decision-properties" aria-labelledby="decision-properties">',
      '<aside class="mentions panel-block"',
      '<details class="neighbourhood-fold">',
    ]);
    expect(html).not.toContain("entity-changed");
    expect(html).not.toContain("entity-toc");
    expect(html).not.toContain('class="legend"');
    expect(html).not.toContain("entity-space");
    expectBalanced(html);
  });

  it("reads one chip with the type, leading to the pages of the type, and the status, then the identifier of the note in the monospace family, then the day of the decision", () => {
    expect(render()).toContain(
      '<p class="entity-badge"><span class="badge decision-chip"><a class="decision-type" href="../../search/?type=decision">Decision</a> · <span class="decision-status">Accepted</span></span><code class="decision-id">decisions/suggestions-in-service-planned</code><time class="decision-date" datetime="2026-05-14">May 14, 2026</time></p>',
    );
  });

  it("keeps the type in plain words when the page knows no results page for it, and leaves the day out when the note carries none", () => {
    const html = render((props) => {
      delete props.typeHref;
      delete props.decision.date;
    });
    expect(html).toContain(
      '<span class="badge decision-chip">Decision · <span class="decision-status">Accepted</span></span><code class="decision-id">decisions/suggestions-in-service-planned</code></p>',
    );
    expect(html).not.toContain("decision-date");
    expect(html).not.toContain("<dt>Decided on</dt>");
  });

  it("places the callout of the session after the note, naming its day and pointing at the cue of the transcript that names the decision, at its timecode, without copying what was said", () => {
    const html = render();
    expect(html).toContain(
      '</article><aside class="decision-session" role="note">Decided in session on May 14. The exact passage is in <a class="decision-session-link" href="../../meetings/2026-05-14-suggestion-arbitration/#L6">the minutes</a>, at 41:07.</aside><footer class="entity-footer">',
    );
    const callout = /<aside class="decision-session" role="note">(.*?)<\/aside>/.exec(html)?.[1];
    expect(callout).not.toContain("Participant");
  });

  it("leads the callout to the page of the meeting when no cue names the decision, and says nothing of the day of a session without one", () => {
    const uncued = render((props) => {
      props.decision.sessions = [{ ...session, date: "May 14" }];
    });
    expect(uncued).toContain(
      '<aside class="decision-session" role="note">Decided in session on May 14. See <a class="decision-session-link" href="../../meetings/2026-05-14-suggestion-arbitration/">the minutes</a>.</aside>',
    );
    const undated = render((props) => {
      props.decision.sessions = [session];
    });
    expect(undated).toContain(
      '<aside class="decision-session" role="note">Decided in session. See <a class="decision-session-link" href="../../meetings/2026-05-14-suggestion-arbitration/">the minutes</a>.</aside>',
    );
  });

  it("renders one callout per session, and none for a decision no meeting documents", () => {
    const two = render((props) => {
      props.decision.sessions = [
        ...props.decision.sessions,
        { label: "Lint follow-up", href: "../../meetings/2026-06-04-lint-follow-up/" },
      ];
    });
    expect(count(two, '<aside class="decision-session" role="note">')).toBe(2);
    expect(two).toContain(
      '<dt>Session</dt><dd><a href="../../meetings/2026-05-14-suggestion-arbitration/">Suggestion arbitration</a>, <a href="../../meetings/2026-06-04-lint-follow-up/">Lint follow-up</a></dd>',
    );
    const none = render((props) => {
      props.decision.sessions = [];
    });
    expect(none).not.toContain("decision-session");
    expect(none).not.toContain("<dt>Session</dt>");
    expect(none).toContain(
      '<p class="panel-note">4 keys: the status and the date are authoritative.</p>',
    );
  });

  it("keeps a sentence without the placeholder of the link as it is", () => {
    const html = render((props) => {
      props.decision.labels = { ...props.decision.labels, sessionPassage: "At {time}." };
    });
    expect(html).toContain(
      '<aside class="decision-session" role="note">Decided in session on May 14. At 41:07.</aside>',
    );
  });

  it("stacks the properties of the decision in the panel, the status and the date first, then what it supersedes, what supersedes it and its session, the note counting the keys", () => {
    const html = render((props) => {
      props.decision.supersededBy = { label: "A later decision", href: "../a-later-decision/" };
      props.decision.labels = {
        ...props.decision.labels,
        keysNote: "5 keys: the status and the date are authoritative.",
      };
    });
    expect(html).toContain(
      '<dl class="attributes"><div class="attribute"><dt>Status</dt><dd>Accepted</dd></div><div class="attribute"><dt>Decided on</dt><dd><time datetime="2026-05-14">May 14, 2026</time></dd></div><div class="attribute"><dt>Supersedes</dt><dd><a href="../suggestions-in-service-deferred/">Suggestions in service deferred</a></dd></div><div class="attribute"><dt>Superseded by</dt><dd><a href="../a-later-decision/">A later decision</a></dd></div><div class="attribute"><dt>Session</dt><dd><a href="../../meetings/2026-05-14-suggestion-arbitration/">Suggestion arbitration</a></dd></div></dl><p class="panel-note">5 keys: the status and the date are authoritative.</p>',
    );
    const bare = render((props) => {
      delete props.decision.supersedes;
      props.decision.sessions = [];
    });
    expect(bare).not.toContain("<dt>Supersedes</dt>");
    expect(bare).not.toContain("<dt>Superseded by</dt>");
  });

  it("hands the related pages the note that a decision cites what it changes, and folds the neighbourhood unless the page asks for the map open", () => {
    const html = render();
    expect(html).toContain(
      '<p class="related-note">A decision affects pages without being affected by them: its relations are almost all written.</p>',
    );
    expect(html).toContain('<details class="neighbourhood-fold">');
    expect(render((props) => (props.mapOpen = true))).toContain(
      '<details class="neighbourhood-fold" open>',
    );
  });

  it("renders the documents of the note under it, and the page without its tree and its breadcrumb when the view model has none", () => {
    const html = render((props) => {
      delete props.space;
      delete props.breadcrumb;
      props.documents = [
        {
          file: { label: "options.pdf", href: "options.pdf", format: "pdf" },
          unit: "page",
          positions: [{ number: 1, label: "page 1", text: "The options considered." }],
        },
      ];
    });
    expect(html).toContain('<div class="entity decision">');
    expect(html).not.toContain('<nav class="space"');
    expect(html).not.toContain('<nav class="breadcrumbs"');
    expect(html).toContain("The options considered.");
  });

  it("words its own English for every label the view model does not carry, the count of keys read from the rows", () => {
    const html = render((props) => {
      delete props.decision.labels;
      delete props.labels;
      delete props.mentions.labels;
      props.neighbours = { ...props.neighbours };
      delete props.neighbours.total;
    });
    expect(html).toContain('<span class="neighbourhood-count">5 pages</span>');
    expect(html).toContain("<dt>Status</dt>");
    expect(html).toContain("<dt>Decided on</dt>");
    expect(html).toContain(
      '<p class="panel-note">4 keys: the status and the date are authoritative.</p>',
    );
    expect(html).toContain("Decided in session on May 14. The exact passage is in <a");
    expect(html).toContain(
      '<p class="related-note">A decision affects pages without being affected by them: its relations are almost all written.</p>',
    );
    expect(defaultDecisionLabels(1).keysNote).toBe(
      "1 key: the status and the date are authoritative.",
    );
    expect(
      decisionKeyCount({ status: { value: "proposed", label: "Proposed" }, sessions: [] }),
    ).toBe(1);
    expect(decisionKeyCount(fixture.decision)).toBe(4);
  });
});
