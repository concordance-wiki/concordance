import { describe, expect, it } from "vitest";

import { documentPageCorporate } from "../../../src/gallery/fixtures.js";
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
  return render({ document: { kind: view.kind, files: view.files, ...document }, ...overrides });
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

  it("offers the three views as a tab bar of anchors with the download of the original at its end", () => {
    const html = render();
    expect(html).toContain(
      '<nav class="document-tabs" aria-label="Views of the document"><a class="document-tab document-tab-view" href="#document-view">Document</a><a class="document-tab document-tab-text" href="#document-text">Extracted text</a><a class="document-tab document-tab-notes" href="#document-notes">Related notes</a><a class="document-download" href="2026/transcript-publication-framing.pptx" download="transcript-publication-framing.pptx">Download the original</a></nav>',
    );
    expect(html).toContain(
      '<section id="document-view" class="document-panel document-view" aria-label="Document">',
    );
    expect(html).toContain(
      '<section id="document-text" class="document-panel document-text" aria-label="Extracted text">',
    );
    expect(html).toContain(
      '<section id="document-notes" class="document-panel document-notes" aria-label="Related notes">',
    );
    expect(count(html, "<h1>")).toBe(1);
    const without = render({ documents: [] });
    expect(without).not.toContain('class="document-download"');
    expect(without).toContain(
      '<section id="document-view" class="document-panel document-view" aria-label="Document"></section>',
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
      '<section id="document-notes" class="document-panel document-notes" aria-label="Related notes"><article class="entity-body"><section id="notes"><div class="markdown">',
    );
    expect(html).toContain('<section id="decisions"><h2>Decisions</h2>');
    expect(html).toContain(
      '<footer class="legend"><span class="legend-written">written link</span><span class="legend-recognised">recognised word, existing note</span><span class="legend-keyword">recognised word, no note</span></footer>',
    );
    expect(render({ sections: [] })).toContain(
      'aria-label="Related notes"><p class="empty">No note describes this document yet.</p></section>',
    );
  });

  it("closes the column with the path of every file, the edit link on the note", () => {
    const html = render();
    expect(html).toContain(
      '<footer class="entity-footer"><p class="entity-source"><code>framing/2026/transcript-publication-framing.md</code><span class="entity-edit-lead">Something to correct? <a class="entity-edit" href="https://forge.example/framing/edit/main/2026/transcript-publication-framing.md">Edit this page</a></span></p><p class="entity-source"><code>framing/2026/transcript-publication-framing.pptx</code></p></footer>',
    );
  });
});

describe("The panel: the properties read from the file, the files that make the document, the related pages, the neighbourhood folded", () => {
  it("lists the type, the author, the page count and the date, with the note that they were read from the file", () => {
    const html = render();
    expect(html).toContain(
      '<section class="panel-block entity-panel" aria-labelledby="entity-properties"><details class="panel-fold"><summary><h2 id="entity-properties">Properties</h2></summary><dl class="attributes"><div class="attribute"><dt>Type</dt><dd>Presentation</dd></div><div class="attribute"><dt>Author</dt><dd>Participant-2</dd></div><div class="attribute"><dt>Pages</dt><dd>24</dd></div><div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-12">March 12, 2026</time></dd></div></dl><p class="panel-note">Read from the file, distinct from the repository date.</p></details></section>',
    );
  });

  it("keeps the slots of the properties the corpus has no datum for, empty, and drops the note for a date taken from the repository", () => {
    const html = withView({
      date: { date: "2026-03-14", label: "March 14, 2026", fromFile: false },
    });
    expect(html).toContain('<div class="attribute"><dt>Author</dt><dd></dd></div>');
    expect(html).toContain('<div class="attribute"><dt>Pages</dt><dd></dd></div>');
    expect(html).toContain(
      '<div class="attribute"><dt>Date</dt><dd><time datetime="2026-03-14">March 14, 2026</time></dd></div></dl></details>',
    );
    expect(html).not.toContain("Read from the file");
    expect(withView({})).toContain(
      '<div class="attribute"><dt>Date</dt><dd></dd></div></dl></details>',
    );
  });

  it("lists the files that make the document, the original, its preview and the note, under the note on how they were grouped", () => {
    const html = render();
    expect(html).toContain(
      '<section class="panel-block entity-panel document-files" aria-labelledby="document-files"><details class="panel-fold"><summary><h2 id="document-files">Same document, 3 files</h2></summary><ul class="document-twins"><li><a class="document-twin-name" href="2026/transcript-publication-framing.pptx">.pptx</a><span class="document-twin-role">original</span></li><li><a class="document-twin-name" href="2026/transcript-publication-framing.pdf">.pdf</a><span class="document-twin-role">preview</span></li><li><a class="document-twin-name" href="#document-notes">transcript-publication-framing.md</a><span class="document-twin-role">session notes</span></li></ul><p class="panel-note">Grouped by folder, date and textual overlap — a single entry in the index.</p></details></section>',
    );
    const plain = withView({
      files: [{ label: ".pdf", role: "original" }],
      labels: {},
    });
    expect(plain).toContain(
      '<h2 id="document-files">Same document, 1 file</h2></summary><ul class="document-twins"><li><span class="document-twin-name">.pdf</span><span class="document-twin-role">original</span></li></ul>',
    );
  });

  it("stacks the related pages and the neighbourhood folded behind its line after the files", () => {
    const html = render();
    const files = html.indexOf('aria-labelledby="document-files"');
    const related = html.indexOf('<h2 id="mentions-title">Related pages');
    const map = html.indexOf('<details class="neighbourhood-fold">');
    expect(files).toBeGreaterThan(0);
    expect(related).toBeGreaterThan(files);
    expect(map).toBeGreaterThan(related);
    expect(html).toContain('<span class="neighbourhood-count">4 pages</span>');
    expect(count(html, '<li class="related-page')).toBe(5);
  });

  it("words its labels itself when the page carries none, one file singular", () => {
    const labels = defaultDocumentPageLabels(1);
    expect(labels.sameDocument).toBe("Same document, 1 file");
    expect(defaultDocumentPageLabels(3).sameDocument).toBe("Same document, 3 files");
    expect(labels).toMatchObject({
      document: "Document",
      extractedText: "Extracted text",
      relatedNotes: "Related notes",
      downloadOriginal: "Download the original",
      dateNote: "Read from the file, distinct from the repository date.",
      groupedNote: "Grouped by folder, date and textual overlap — a single entry in the index.",
    });
    const { labels: pageLabels, ...unlabelled } = documentPageCorporate;
    expect(pageLabels).toBeDefined();
    const html = renderSlot(
      "EntityPage",
      { ...unlabelled, document: { kind: view.kind, files: view.files } },
      defaultTheme,
    );
    expect(html).toContain('<h2 id="document-files">Same document, 3 files</h2>');
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
