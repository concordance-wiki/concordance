import { describe, expect, it } from "vitest";

import { documentPageCorporate, documentPageNoPreview } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { DocumentPageView, DocumentView, EntityPageProps } from "../../../src/slots.js";
import {
  centralOf,
  defaultDocumentPageLabels,
  pageNumber,
} from "../../../src/theme/default/document-page.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

const view = documentPageCorporate.document as DocumentPageView;
const deck = documentPageCorporate.documents?.[0] as DocumentView;

function render(overrides: Partial<EntityPageProps> = {}): string {
  return renderSlot("EntityPage", { ...documentPageCorporate, ...overrides }, defaultTheme);
}

/** The document page with its view model reduced to what a corpus without the datum would give. */
function withView(document: Partial<DocumentPageView>, overrides: Partial<EntityPageProps> = {}) {
  return render({ document: { kind: view.kind, ...document }, ...overrides });
}

describe("The document page: the tree by year, the line under the title, the tabs", () => {
  it("is the entity slot laid out as a document page as soon as the build hands the document block, the generic page otherwise", () => {
    const html = render();
    expectBalanced(html);
    expect(html).toContain('<div class="entity entity-with-space document-page">');
    expect(html).not.toContain('<article class="entity-body">\n');
    const { document, ...generic } = documentPageCorporate;
    expect(document).toBeDefined();
    const plain = renderSlot("EntityPage", generic, defaultTheme);
    expect(plain).not.toContain("document-page");
    expect(plain).toContain('<section class="document document-slide"');
  });

  it("shows the tree of the space folded by year and month, the current month open and the deck ruled, then the breadcrumb through the month", () => {
    const html = render();
    expect(html).toContain(
      '<span class="space-folder-name">2026<span class="count">3</span></span>',
    );
    expect(html).toContain(
      '<li class="space-folder space-open"><span class="space-folder-name">March<span class="count">1</span></span>',
    );
    expect(html).toContain('<span aria-current="page">Transcript publication framing</span>');
    expect(html).toContain(
      '<span class="space-folder-name">2025<span class="count">9</span></span>',
    );
    expect(html).toContain(
      '<ol class="breadcrumbs-list"><li><a href="../../../#home-tree">framing</a></li><li><span>March 2026</span></li><li><span aria-current="page">Transcript publication framing</span></li></ol>',
    );
    const { space, breadcrumb, ...bare } = documentPageCorporate;
    expect(space).toBeDefined();
    expect(breadcrumb).toHaveLength(3);
    expect(renderSlot("EntityPage", bare, defaultTheme)).toContain(
      '<div class="entity document-page">',
    );
    expect(render({ breadcrumb: [] })).not.toContain('class="breadcrumbs"');
  });

  it("names the kind, the page count, the size and the date read from the file on the line under the title", () => {
    const html = render();
    expect(html).toContain("<h1>Transcript publication framing</h1>");
    expect(html).toContain(
      '<p class="entity-badge document-line"><span class="badge">Presentation</span><span class="document-pages">24 pages</span><span class="document-size">4.2 MB</span><time class="document-date" datetime="2026-03-12">March 12, 2026</time></p>',
    );
    expect(withView({})).toContain(
      '<p class="entity-badge document-line"><span class="badge">Presentation</span></p>',
    );
    // A count the build did not word is worded by the theme.
    expect(withView({ pages: 12 })).toContain('<span class="document-pages">12 pages</span>');
  });

  it("offers the three views behind the tabs of the theme, anchors following the tablist pattern, with the download of the original at the end of the bar", () => {
    const html = render();
    expect(html).toContain(
      '<div class="tabs document-views"><div class="tabs-bar"><concordance-island data-island="tabs" data-props="{&quot;label&quot;:&quot;Views of the document&quot;,&quot;tabs&quot;:[{&quot;id&quot;:&quot;document-view&quot;,&quot;label&quot;:&quot;Document&quot;},{&quot;id&quot;:&quot;document-text&quot;,&quot;label&quot;:&quot;Extracted text&quot;},{&quot;id&quot;:&quot;document-notes&quot;,&quot;label&quot;:&quot;Related notes&quot;}]}"><div class="tabs-list" role="tablist" aria-label="Views of the document"><a class="tab" role="tab" id="tab-document-view" href="#document-view" aria-controls="document-view" aria-selected="true">Document</a><a class="tab" role="tab" id="tab-document-text" href="#document-text" aria-controls="document-text" aria-selected="false">Extracted text</a><a class="tab" role="tab" id="tab-document-notes" href="#document-notes" aria-controls="document-notes" aria-selected="false">Related notes</a></div></concordance-island><a class="document-download" href="2026/transcript-publication-framing.pptx" download="transcript-publication-framing.pptx">Download the original</a></div>',
    );
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="document-view" aria-labelledby="tab-document-view">',
    );
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="document-text" aria-labelledby="tab-document-text"><div class="document-text">',
    );
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="document-notes" aria-labelledby="tab-document-notes">',
    );
    expect(count(html, "<h1>")).toBe(1);
    const without = render({ documents: [] });
    expect(without).not.toContain('class="document-download"');
    expect(without).toContain(
      '<section class="tabs-panel" role="tabpanel" id="document-view" aria-labelledby="tab-document-view"></section>',
    );
    expect(without).toContain('<p class="empty">No text was extracted from this document.</p>');
    const { documents, ...none } = documentPageCorporate;
    expect(documents).toHaveLength(1);
    expect(renderSlot("EntityPage", none, defaultTheme)).toBe(without);
  });
});

describe("The document view: the strip of pages, the rendering of the current page and its notes", () => {
  it("draws one numbered thumbnail per page, the first one current, each named for assistive technology and leading to its text", () => {
    const html = render();
    expect(html).toContain(
      '<nav class="document-rail" aria-label="Pages"><span class="section-label" aria-hidden="true">Pages</span><ol>',
    );
    expect(count(html, '<li><a href="#L')).toBe(24);
    expect(html).toContain(
      '<li><a href="#L1" data-position="1" class="current" aria-current="true"><span class="document-number" aria-hidden="true">01</span><span class="visually-hidden">slide 1</span></a></li>',
    );
    expect(html).toContain(
      '<li><a href="#L24" data-position="24"><span class="document-number" aria-hidden="true">24</span><span class="visually-hidden">slide 24</span></a></li>',
    );
    // The other `aria-current` of the page is the hop of the neighbourhood map.
    expect(count(html, 'class="current" aria-current="true"')).toBe(1);
    expect(pageNumber(7)).toBe("07");
    expect(pageNumber(124)).toBe("124");
    expect(render({ documents: [{ ...deck, positions: [] }] })).not.toContain(
      'class="document-rail"',
    );
  });

  it("serves the viewer island to open at once, the PDF as the browser shows it behind a noscript, then the two notes", () => {
    const html = render();
    const match = /data-island="document-viewer" data-props="([^"]*)"/.exec(html);
    const props = JSON.parse((match?.[1] ?? "").replaceAll("&quot;", '"')) as {
      pdfHref: string;
      open?: boolean;
      labels: { unit: string };
    };
    expect(props.pdfHref).toBe("2026/transcript-publication-framing.pdf");
    expect(props.open).toBe(true);
    expect(props.labels.unit).toBe("slide");
    expect(html).toContain(
      '<noscript><object class="document-embed" data="2026/transcript-publication-framing.pdf" type="application/pdf" aria-label="Preview"><a class="document-pdf" href="2026/transcript-publication-framing.pdf">Open the PDF</a></object></noscript>',
    );
    expect(html).toContain(
      '<p class="document-render-note"><span>Converted at publication, cached by fingerprint</span><span>The original stays downloadable</span></p>',
    );
    expect(html.indexOf('class="document-rail"')).toBeLessThan(html.indexOf("document-viewer"));
    expect(html.indexOf("</noscript>")).toBeLessThan(html.indexOf('class="document-render-note"'));
  });

  it("shows the PDF as the browser shows it, in the page, when the build produced no viewer, and nothing to render without a PDF", () => {
    const { viewerHref, workerHref, ...preview } = deck.preview ?? { href: "" };
    expect(viewerHref).toBeDefined();
    expect(workerHref).toBeDefined();
    const noViewer = render({ documents: [{ ...deck, preview }] });
    expect(noViewer).not.toContain("<noscript>");
    expect(noViewer).not.toContain('data-island="document-viewer"');
    expect(noViewer).toContain(
      '<div class="document-render"><object class="document-embed" data="2026/transcript-publication-framing.pdf" type="application/pdf" aria-label="Preview">',
    );
    const { preview: dropped, ...noPdf } = deck;
    expect(dropped).toBeDefined();
    const unconverted = render({ documents: [noPdf] });
    expect(unconverted).not.toContain("document-embed");
    expect(unconverted).not.toContain('data-island="document-viewer"');
    expect(unconverted).toContain('<div class="document-render"><p class="document-render-note">');
  });
});

describe("The text and the notes: reachable without JavaScript by their anchors", () => {
  it("serves the extracted text of every page in disclosure blocks anchored as the mentions cite them, the first one open", () => {
    const html = render();
    expect(count(html, "<details")).toBeGreaterThanOrEqual(24);
    expect(html).toContain(
      '<details id="L1" open><summary>slide 1</summary><p>Transcript publication framing</p></details>',
    );
    expect(html).toContain(
      '<details id="L24"><summary>slide 24</summary><p>Questions</p></details>',
    );
    expect(html).not.toContain("<h3>Extracted text</h3>");
  });

  it("renders the note merged with the document with its legend, and says so when there is none", () => {
    const html = render();
    expect(html).toContain(
      '<section class="tabs-panel" role="tabpanel" id="document-notes" aria-labelledby="tab-document-notes"><article class="entity-body"><section id="notes"><div class="markdown">',
    );
    expect(html).toContain('<section id="decisions"><h2>Decisions</h2>');
    expect(html).toContain(
      '<footer class="legend"><span class="legend-written">written link</span><span class="legend-recognised">recognised word, existing note</span><span class="legend-keyword">recognised word, no note</span></footer>',
    );
    expect(render({ sections: [] })).toContain(
      'aria-labelledby="tab-document-notes"><p class="empty">No note describes this document yet.</p></section>',
    );
  });

  it("closes the column with the path of every file, the edit link on the note", () => {
    const html = render();
    expect(html).toContain(
      '<footer class="entity-footer"><p class="entity-source"><code>framing/2026/transcript-publication-framing.md</code><span class="entity-edit-lead">Something to correct? <a class="entity-edit" href="https://forge.example/framing/edit/main/2026/transcript-publication-framing.md">Edit this page</a></span></p><p class="entity-source"><code>framing/2026/transcript-publication-framing.pdf</code></p><p class="entity-source"><code>framing/2026/transcript-publication-framing.pptx</code></p></footer>',
    );
  });
});

describe("The panel: the properties read from the file, the files the build grouped, the related pages, the neighbourhood folded", () => {
  it("lists the type, the author, the page count and the date, with the note that they were read from the file", () => {
    const html = render();
    expect(html).toContain(
      '<section class="panel-block entity-panel" aria-labelledby="entity-properties"><details class="panel-fold"><summary><h2 id="entity-properties">Properties</h2></summary><dl class="attributes"><div class="attribute"><dt>Type</dt><dd>Presentation</dd></div><div class="attribute"><dt>Author</dt><dd>Participant-2</dd></div><div class="attribute"><dt>Pages</dt><dd>24</dd></div><div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-12">March 12, 2026</time></dd></div></dl><p class="panel-note">Read from the file, distinct from the repository date.</p><div class="grouped-files">',
    );
  });

  it("draws the domain after the date when the build filed the document, and no row otherwise", () => {
    const html = render({
      document: {
        ...view,
        domain: {
          name: "domain",
          label: "Domain",
          values: [{ text: "Quality", href: "../search/?domain=quality" }],
        },
      },
    });
    expect(html).toContain(
      '<div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-12">March 12, 2026</time></dd></div><div class="attribute"><dt>Domain</dt><dd><a class="value" href="../search/?domain=quality">Quality</a></dd></div></dl>',
    );
    expect(render()).not.toContain("<dt>Domain</dt>");
  });

  it("keeps the slots of the properties the corpus has no datum for, empty, and drops the note for a date taken from the repository", () => {
    const html = withView({
      date: { date: "2026-03-14", label: "March 14, 2026", fromFile: false },
    });
    expect(html).toContain('<div class="attribute"><dt>Author</dt><dd></dd></div>');
    expect(html).toContain('<div class="attribute"><dt>Pages</dt><dd></dd></div>');
    expect(html).toContain(
      '<div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-14">March 14, 2026</time></dd></div></dl><div class="grouped-files">',
    );
    expect(html).not.toContain("Read from the file");
    expect(withView({})).toContain(
      '<div class="attribute"><dt>Date</dt><dd></dd></div></dl><div class="grouped-files">',
    );
  });

  it("says under the properties when the size or the page count comes from the PDF preview", () => {
    expect(withView({ pages: 24, size: "6.1 MB", fromPreview: true })).toContain(
      '<div class="attribute"><dt>Date</dt><dd></dd></div></dl><p class="panel-note">Size and page count of the PDF preview, the original stating none.</p><div class="grouped-files">',
    );
    expect(render()).not.toContain("of the PDF preview");
  });

  it("says at the foot of the properties which files the build grouped and why, each with its kind, then how to separate them; nothing for a page of one file", () => {
    const html = render();
    expect(html).toContain(
      '<p class="panel-note">Read from the file, distinct from the repository date.</p><div class="grouped-files"><p class="grouped-files-lead">3 files grouped — same base name, similar content</p><ul class="grouped-files-list"><li><code class="grouped-file-name">transcript-publication-framing.md</code><span class="grouped-file-format">Markdown note</span></li><li><code class="grouped-file-name">transcript-publication-framing.pdf</code><span class="grouped-file-format">PDF</span></li><li><code class="grouped-file-name">transcript-publication-framing.pptx</code><span class="grouped-file-format">Presentation</span></li></ul><a class="grouped-files-separate" href="https://forge.example/framing">Separate these files</a></div></details></section>',
    );
    expect(html).not.toContain("Same document");
    const { grouping, ...alone } = documentPageCorporate;
    expect(grouping).toBeDefined();
    expect(renderSlot("EntityPage", alone, defaultTheme)).not.toContain("grouped-files");
  });

  it("stacks the related pages and the neighbourhood folded behind its line after the properties", () => {
    const html = render();
    const files = html.indexOf('class="grouped-files"');
    const related = html.indexOf('<h2 id="mentions-title">Related pages');
    const map = html.indexOf('<details class="neighbourhood-fold">');
    expect(files).toBeGreaterThan(0);
    expect(related).toBeGreaterThan(files);
    expect(map).toBeGreaterThan(related);
    expect(html).toContain('<span class="neighbourhood-count">4 pages</span>');
    expect(count(html, '<li class="related-page')).toBe(5);
  });

  it("words its labels itself when the page carries none", () => {
    const labels = defaultDocumentPageLabels();
    expect(labels).toMatchObject({
      document: "Document",
      extractedText: "Extracted text",
      relatedNotes: "Related notes",
      downloadOriginal: "Download the original",
      dateNote: "Read from the file, distinct from the repository date.",
      previewNote: "Size and page count of the PDF preview, the original stating none.",
    });
    const { labels: pageLabels, ...unlabelled } = documentPageCorporate;
    expect(pageLabels).toBeDefined();
    const html = renderSlot(
      "EntityPage",
      { ...unlabelled, document: { kind: view.kind } },
      defaultTheme,
    );
    expect(html).toContain('<h2 id="entity-properties">Properties</h2>');
    expect(html).toContain(
      '<a class="document-download" href="2026/transcript-publication-framing.pptx" download="transcript-publication-framing.pptx">Download the original</a>',
    );
    expect(html).toContain('aria-label="Tree of the space"');
    expect(html).toContain('aria-label="You are here"');
    expect(html).toContain("Something to correct?");
  });

  it("centres the page on the first document that is not a transcript", () => {
    const transcript: DocumentView = {
      file: { label: "a.vtt", href: "a.vtt", format: "vtt" },
      unit: "cue",
      positions: [],
    };
    expect(centralOf([transcript, deck])).toBe(deck);
    expect(centralOf([transcript])).toBeUndefined();
    expect(centralOf([])).toBeUndefined();
  });
});

describe("A document whose conversion failed: the fact named in place of the rendering", () => {
  const failed = documentPageNoPreview.document as DocumentPageView;
  const bare = documentPageNoPreview.documents?.[0] as DocumentView;

  it("names the fact, says the text was extracted, offers the original and unfolds the finding with the check after the cause", () => {
    const html = renderSlot("EntityPage", documentPageNoPreview, defaultTheme);
    expect(html).toContain(
      '<div class="document-failure"><aside class="page-notice" role="note"><p class="page-notice-lead">The preview of this document could not be generated.</p><p class="page-notice-detail">The text was extracted all the same: it is indexed, cited on the other pages, and readable below.</p>',
    );
    expect(html).toContain(
      '<div class="page-notice-exits"><a class="button-primary" href="2026/transcript-publication-framing.pptx" download="transcript-publication-framing.pptx">Download the original</a><details class="page-notice-why"><summary class="button-secondary">Why this failure?</summary><p>conversion of 2026/transcript-publication-framing.pptx failed: timed out after 120 s <code>W-CONV-FAILED</code></p></details></div></aside>',
    );
    expect(html).not.toContain("document-stage");
    expect(html).not.toContain("document-render");
    expectBalanced(html);
  });

  it("lists the extracted text position by position under its heading, indexed and searchable", () => {
    const html = renderSlot("EntityPage", documentPageNoPreview, defaultTheme);
    expect(html).toContain(
      '<section class="document-extracted" aria-labelledby="document-extracted"><header class="document-extracted-head"><h2 id="document-extracted" class="section-label">Extracted text — 24 pages</h2><span class="document-extracted-note">indexed and searchable</span></header><ol class="document-extracted-list"><li><span class="document-extracted-position">slide 1</span><p>Transcript publication framing</p></li>',
    );
    expect(count(html, '<li><span class="document-extracted-position">')).toBe(24);
  });

  it("says the text could not be extracted either when no position was read, and lists nothing", () => {
    const html = renderSlot(
      "EntityPage",
      { ...documentPageNoPreview, documents: [{ ...bare, positions: [] }] },
      defaultTheme,
    );
    expect(html).toContain(
      '<p class="page-notice-detail">Its text could not be extracted either: the original stays downloadable, and the note that describes it stands among its files.</p>',
    );
    expect(html).not.toContain("document-extracted");
  });

  it("writes the state of every representation in the panel, the one that failed marked, then where the failure is reported", () => {
    const html = renderSlot("EntityPage", documentPageNoPreview, defaultTheme);
    expect(html).toContain(
      '<h2 id="document-representations">State of the representations</h2></summary><ul class="document-states"><li><code>.pptx</code><span>available</span></li><li class="document-state-failed"><code>.pdf preview</code><span>failed</span></li><li><code>text</code><span>extracted</span></li></ul><p class="panel-note">The same finding stands in the publication report and in the linter output: the failure is reported to whoever can fix it.</p>',
    );
    const withoutStates = { ...failed };
    delete withoutStates.representations;
    const silent = renderSlot(
      "EntityPage",
      { ...documentPageNoPreview, document: withoutStates },
      defaultTheme,
    );
    expect(silent).not.toContain("document-states");
    expect(silent).toContain('<div class="document-failure">');
  });

  it("words the notice with the theme's own labels when the page gives none", () => {
    const labels = defaultDocumentPageLabels();
    expect(labels.previewFailed).toBe("The preview of this document could not be generated.");
    expect(labels.whyFailed).toBe("Why this failure?");
    expect(labels.extractedTextOf).toBe("Extracted text");
    expect(labels.representations).toBe("State of the representations");
    const unworded = { ...failed };
    delete unworded.labels;
    const html = renderSlot(
      "EntityPage",
      { ...documentPageNoPreview, document: unworded },
      defaultTheme,
    );
    expect(html).toContain('<h2 id="document-extracted" class="section-label">Extracted text</h2>');
  });
});
