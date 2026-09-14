import { describe, expect, it } from "vitest";

import { corporateMeetingPage } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { DocumentView, EntityPageProps, MeetingProps } from "../../../src/slots.js";
import { EntityPage } from "../../../src/theme/default/index.js";
import { cueTime, defaultMeetingLabels } from "../../../src/theme/default/meeting-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

// The gallery fixture carries a meeting, asserted by the first test: the state of the page that the tests vary.
const fixture = corporateMeetingPage as EntityPageProps & { meeting: MeetingProps };

type MeetingPageProps = EntityPageProps & { meeting: MeetingProps };

/** Renders the fixture, a copy of it adjusted by the test first. */
function render(adjust: (props: MeetingPageProps) => void = () => undefined): string {
  const props: MeetingPageProps = { ...fixture, meeting: { ...fixture.meeting } };
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

// The fixture carries a transcript: the tests vary its cues.
const transcript = fixture.documents?.find((document) => document.unit === "cue") as DocumentView;

describe("MeetingPage", () => {
  it("is what the default theme renders for a view model that carries a meeting, the generic template otherwise", () => {
    expect(render()).toContain('<div class="entity entity-with-space meeting">');
    const { meeting, ...generic } = fixture;
    expect(meeting).toBeDefined();
    expect(renderSlot("EntityPage", generic, defaultTheme)).toContain(
      '<div class="entity entity-with-space">',
    );
    expect(EntityPage).toBe(defaultTheme.components.EntityPage);
  });

  it("lays the page out on the shell of the entity page: the tree, the breadcrumb naming the month, the title, the line reading the type, the duration and the participants, the tabs, the decision, the files, then the panel", () => {
    const html = render();
    expectInOrder(html, [
      '<nav class="space" aria-label="Tree of the space">',
      '<li class="space-folder space-open"><span class="space-folder-name">2026<span class="count">6</span></span>',
      '<li class="space-folder space-open"><span class="space-folder-name">March<span class="count">1</span></span>',
      '<li class="space-page space-current"><span aria-current="page">Keyword page threshold review</span></li>',
      '<li><a href="../../#home-tree">meetings</a></li><li><span>March 2026</span></li><li><span aria-current="page">Keyword page threshold review</span></li>',
      "<h1>Keyword page threshold review</h1>",
      '<p class="entity-badge"><span class="badge">Meeting</span><span class="meeting-duration">1 h 12</span><span class="meeting-participants">Pseudonymised participants</span></p>',
      '<div class="tabs meeting-representations">',
      '<aside class="meeting-decision" role="note">',
      '<footer class="entity-footer">',
      '<code><span class="entity-source-folders">meetings/</span>2026-03-12-keyword-page-threshold-review.vtt</code>',
      '<div class="entity-side">',
      '<section class="panel-block entity-panel meeting-properties" aria-labelledby="meeting-properties">',
      '<aside class="mentions panel-block"',
      '<details class="neighbourhood-fold">',
    ]);
    expect(html).not.toContain("entity-changed");
    expect(html).not.toContain("entity-toc");
    expectBalanced(html);
  });

  it("offers one tab per representation through the tabs of the theme, the transcript first, then the notes, then the deck, the panels labelled by their tabs, the grouping named at the end of the row", () => {
    const html = render();
    expect(html).toContain(
      '<div class="tabs meeting-representations"><div class="tabs-bar"><concordance-island data-island="tabs" data-props="{&quot;label&quot;:&quot;Representations&quot;,&quot;tabs&quot;:[{&quot;id&quot;:&quot;representation-transcript&quot;,&quot;label&quot;:&quot;Transcript&quot;},{&quot;id&quot;:&quot;representation-notes&quot;,&quot;label&quot;:&quot;Notes&quot;},{&quot;id&quot;:&quot;representation-deck&quot;,&quot;label&quot;:&quot;Deck&quot;}]}"><div class="tabs-list" role="tablist" aria-label="Representations"><a class="tab" role="tab" id="tab-representation-transcript" href="#representation-transcript" aria-controls="representation-transcript" aria-selected="true">Transcript</a><a class="tab" role="tab" id="tab-representation-notes" href="#representation-notes" aria-controls="representation-notes" aria-selected="false">Notes</a><a class="tab" role="tab" id="tab-representation-deck" href="#representation-deck" aria-controls="representation-deck" aria-selected="false">Deck</a></div></concordance-island><span class="meeting-grouped">Grouped automatically</span></div>',
    );
    expectInOrder(html, [
      '<section class="tabs-panel" role="tabpanel" id="representation-transcript" aria-labelledby="tab-representation-transcript">',
      '<section class="tabs-panel" role="tabpanel" id="representation-notes" aria-labelledby="tab-representation-notes">',
      '<section class="tabs-panel" role="tabpanel" id="representation-deck" aria-labelledby="tab-representation-deck">',
    ]);
    expect(count(html, 'class="tabs-panel"')).toBe(3);
  });

  it("writes the transcript as timestamped lines, each timecode an anchor of the position the mentions cite, the speaker in bold before what was said, the file to download and the note on the pseudonyms under them", () => {
    const html = render();
    expect(html).toContain(
      '<ol class="transcript"><li class="cue" id="L1-2"><a class="cue-time" href="#L1-2">11:48</a><p class="cue-text"><b class="cue-speaker">Participant-1</b> — We come back to the threshold',
    );
    expect(html).toContain('<a class="cue-time" href="#L5-2">01:12:20</a>');
    expect(html).toContain(
      '<a class="document-download" href="2026-03-12-keyword-page-threshold-review.vtt" download="2026-03-12-keyword-page-threshold-review.vtt">Download 2026-03-12-keyword-page-threshold-review.vtt</a>',
    );
    expect(html).toContain(
      '<p class="meeting-pseudonyms">The names of the participants are replaced at publication by stable pseudonyms. The mapping is never published.</p>',
    );
    expect(cueTime("00:12:04")).toBe("12:04");
    expect(cueTime("01:12:04")).toBe("01:12:04");
  });

  it("names no speaker on a cue without one, says that a transcript has no text when it has none, and keeps the note on the pseudonyms out when pseudonymisation did not apply", () => {
    const cue = { number: 1, label: "00:00:04", text: "Nobody named." };
    const html = render((props) => {
      props.documents = [{ ...transcript, positions: [cue] }];
      props.meeting.pseudonymized = false;
      props.meeting.decisions = [];
    });
    expect(html).toContain(
      '<li class="cue" id="L1"><a class="cue-time" href="#L1">00:04</a><p class="cue-text">Nobody named.</p></li>',
    );
    expect(html).not.toContain("meeting-pseudonyms");
    expect(
      render((props) => {
        props.documents = [{ ...transcript, positions: [] }];
        props.meeting.decisions = [];
      }),
    ).toContain(
      '<section class="tabs-panel" role="tabpanel" id="representation-transcript" aria-labelledby="tab-representation-transcript"><p class="empty">No text was extracted from this document.</p>',
    );
  });

  it("renders the notes as the entity page does, with their legend, and the deck through the document block with its rail and its viewer, once for the original and its PDF", () => {
    const html = render();
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="representation-notes" aria-labelledby="tab-representation-notes"><article class="entity-body"><section id="notes"><div class="markdown">',
    );
    expect(html).toContain('<footer class="legend">');
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="representation-deck" aria-labelledby="tab-representation-deck"><section class="document document-slide" aria-labelledby="document-1">',
    );
    expect(html).toContain('<nav class="document-rail" aria-label="Slides">');
    expect(count(html, 'data-island="document-viewer"')).toBe(1);
    expect(html).toContain("&quot;open&quot;:true}");
    expect(count(html, 'class="document-download"')).toBe(2);
  });

  it("labels a converted document that is not a deck as a document, and suffixes the rank of a second representation of a kind", () => {
    const pdf: DocumentView = {
      file: { label: "notes.pdf", href: "notes.pdf", format: "pdf" },
      unit: "page",
      positions: [{ number: 1, label: "page 1", text: "Notes of the session." }],
    };
    const html = render((props) => {
      props.sections = [];
      props.documents = [transcript, pdf, transcript, pdf];
    });
    expect(html).toContain(
      '<a class="tab" role="tab" id="tab-representation-transcript" href="#representation-transcript" aria-controls="representation-transcript" aria-selected="true">Transcript</a><a class="tab" role="tab" id="tab-representation-transcript-2" href="#representation-transcript-2" aria-controls="representation-transcript-2" aria-selected="false">Transcript</a><a class="tab" role="tab" id="tab-representation-pages" href="#representation-pages" aria-controls="representation-pages" aria-selected="false">Document</a><a class="tab" role="tab" id="tab-representation-pages-2" href="#representation-pages-2" aria-controls="representation-pages-2" aria-selected="false">Document</a>',
    );
    expect(html).not.toContain("representation-notes");
    expect(html).toContain('<li class="cue" id="L1-3">');
    expect(html).toContain('<details id="L1-4" open>');
  });

  it("renders no tabs for a meeting with neither note nor document, the callout of its decisions after the header", () => {
    const html = render((props) => {
      props.sections = [];
      props.documents = [];
    });
    expect(html).not.toContain("meeting-representations");
    expect(html).toContain('</header><div class="meeting-decisions">');
  });

  it("places the callout of a decision under the last cue of the transcript that names it, the decisions no cue names at the head of the transcript, separated by commas, and draws no callout without any", () => {
    expect(render()).toContain(
      '<p class="cue-text"><b class="cue-speaker">Participant-2</b> — In the canonical model only, when the file is written. The pages display the counts of the model and never recount an occurrence.</p><aside class="meeting-decision" role="note"><span class="meeting-decision-lead">Decision taken here</span> <a class="meeting-decision-link" href="../../decisions/threshold-applied-in-model/">Threshold applied in model</a></aside></li>',
    );
    expect(render()).not.toContain("meeting-decisions");
    const two = render((props) => {
      props.meeting.decisions = [
        { label: "Threshold applied in model", href: "../../decisions/threshold/", cue: 4 },
        { label: "Related relation capped", href: "../../decisions/cap/", cue: 4 },
        { label: "Cue beyond the transcript", href: "../../decisions/beyond/", cue: 9 },
        { label: "Written elsewhere", href: "../../decisions/elsewhere/" },
      ];
    });
    expect(two).toContain(
      'Threshold applied in model</a>, <a class="meeting-decision-link" href="../../decisions/cap/">Related relation capped</a></aside></li>',
    );
    expect(two).toContain(
      '<section class="tabs-panel" role="tabpanel" id="representation-transcript" aria-labelledby="tab-representation-transcript"><aside class="meeting-decision" role="note"><span class="meeting-decision-lead">Decision taken here</span> <a class="meeting-decision-link" href="../../decisions/beyond/">Cue beyond the transcript</a>, <a class="meeting-decision-link" href="../../decisions/elsewhere/">Written elsewhere</a></aside><ol class="transcript">',
    );
    expect(count(two, 'class="meeting-decision"')).toBe(2);
    expect(
      render((props) => {
        props.meeting.decisions = [];
      }),
    ).not.toContain("meeting-decision");
  });

  it("draws the callout after the tabs for a meeting without a transcript, and in the first transcript alone when there are two", () => {
    const deck = fixture.documents?.find((document) => document.unit === "slide") as DocumentView;
    const noTranscript = render((props) => {
      props.documents = [deck];
    });
    expect(noTranscript).toContain(
      '</div></div><div class="meeting-decisions"><aside class="meeting-decision" role="note"><span class="meeting-decision-lead">Decision taken here</span> <a class="meeting-decision-link" href="../../decisions/threshold-applied-in-model/">Threshold applied in model</a></aside></div><footer class="entity-footer">',
    );
    const twoTranscripts = render((props) => {
      props.documents = [transcript, transcript];
    });
    expect(count(twoTranscripts, 'class="meeting-decision"')).toBe(1);
    expect(twoTranscripts).toContain(
      '<li class="cue" id="L4"><a class="cue-time" href="#L4">13:02</a><p class="cue-text"><b class="cue-speaker">Participant-2</b>',
    );
    expect(twoTranscripts).toContain(
      '<li class="cue" id="L4-2"><a class="cue-time" href="#L4-2">13:02</a><p class="cue-text"><b class="cue-speaker">Participant-2</b> — In the canonical model only, when the file is written. The pages display the counts of the model and never recount an occurrence.</p></li>',
    );
  });

  it("lists the date, the duration, the space linking to the file tree and the grouped files in the properties block, the reason under them", () => {
    const html = render();
    expect(html).toContain(
      '<dl class="attributes"><div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-12">March 12, 2026</time></dd></div><div class="attribute"><dt>Duration</dt><dd>1 h 12</dd></div><div class="attribute"><dt>Space</dt><dd><a href="../../#home-tree">meetings</a></dd></div><div class="attribute"><dt>Files</dt><dd>3 grouped</dd></div></dl><p class="panel-note">3 files: same folder, same base name, same commit, high textual overlap.</p>',
    );
  });

  it("leaves out the rows the meeting does not give, and the grouping mention with them", () => {
    const html = render((props) => {
      props.space = { name: "meetings", initials: "ME", nodes: [] };
      props.breadcrumb = [];
      delete props.meeting.date;
      delete props.meeting.duration;
      delete props.meeting.participants;
      delete props.meeting.grouping;
    });
    expect(html).toContain(
      '<dl class="attributes"><div class="attribute"><dt>Space</dt><dd>meetings</dd></div></dl></details>',
    );
    expect(html).toContain('<p class="entity-badge"><span class="badge">Meeting</span></p>');
    expect(html).not.toContain("meeting-grouped");
    expect(html).not.toContain("breadcrumbs");
    const unexplained = render((props) => {
      props.meeting.grouping = { count: 2, label: "2 grouped" };
    });
    expect(unexplained).toContain("<dd>2 grouped</dd></div></dl></details>");
    expect(unexplained).toContain('<span class="meeting-grouped">Grouped automatically</span>');
  });

  it("stands without a space: no tree, no space row, the plain entity class", () => {
    const html = render((props) => {
      delete props.space;
    });
    expect(html).toContain('<div class="entity meeting">');
    expect(html).not.toContain('class="space"');
    expect(html).not.toContain("<dt>Space</dt>");
  });

  it("serves the neighbourhood unfolded when the page asks, as the generic template does", () => {
    expect(render()).not.toContain('<details class="neighbourhood-fold" open>');
    const html = render((props) => {
      props.mapOpen = true;
    });
    expect(html).toContain('<details class="neighbourhood-fold" open><summary>');
    expect(html).toContain('<section class="panel-block entity-panel meeting-properties"');
    expectBalanced(html);
  });

  it("counts the listed neighbours when the build did not count them all", () => {
    const html = render((props) => {
      delete props.labels;
      props.neighbours = { centre: "Keyword page threshold review", neighbours: [] };
    });
    expect(html).toContain('<span class="neighbourhood-count">0 pages</span>');
  });

  it("falls back on the labels of the theme for every label the page does not receive, and words the related pages with the note of a meeting", () => {
    const html = render((props) => {
      delete props.labels;
      props.meeting.labels = {};
    });
    expect(html).toContain('aria-label="Representations"');
    expect(html).toContain('<h2 id="meeting-properties">Properties</h2>');
    expect(defaultMeetingLabels.relatedNote).toBe(
      "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    );
    expect(html).toContain(
      "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    );
    expect(
      render((props) => {
        props.meeting.labels = { transcript: "Transcription" };
      }),
    ).toContain(">Transcription</a>");
  });
});
