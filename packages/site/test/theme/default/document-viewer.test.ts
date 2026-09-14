import { describe, expect, it } from "vitest";

import { documentEntityPage } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { DocumentView, EntityPageProps } from "../../../src/slots.js";
import {
  positionAnchor,
  positionCaption,
  viewerLabels,
} from "../../../src/theme/default/document-viewer.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(overrides: Partial<EntityPageProps> = {}): string {
  return renderSlot("EntityPage", { ...documentEntityPage, ...overrides }, defaultTheme);
}

const deck = documentEntityPage.documents?.[0] as DocumentView;
const transcript = documentEntityPage.documents?.[1] as DocumentView;

describe("The original file remains downloadable", () => {
  it("links every document of the entity for download, under its own heading, the PDF next to it when there is one", () => {
    const html = render();
    expectBalanced(html);
    expect(html).toContain(
      '<a class="document-download" href="meetings/threshold-review.pptx" download="threshold-review.pptx">Download threshold-review.pptx</a>',
    );
    expect(html).toContain(
      '<a class="document-pdf" href="meetings/threshold-review.pdf">Open the PDF</a>',
    );
    expect(html).toContain(
      '<a class="document-download" href="meetings/threshold-review.vtt" download="threshold-review.vtt">Download threshold-review.vtt</a>',
    );
    expect(count(html, 'class="document-pdf"')).toBe(1);
    expect(html).toContain('<h2 id="document-1">Document <code>threshold-review.pptx</code></h2>');
    expect(html).toContain('<h2 id="document-2">Document <code>threshold-review.vtt</code></h2>');
    expect(html).toContain(
      '<section class="document document-slide" aria-labelledby="document-1">',
    );
    expect(html).toContain('<section class="document document-cue" aria-labelledby="document-2">');
  });

  it("places the documents under the note and before the side panel, and renders nothing for a note alone", () => {
    const html = render();
    expect(html.indexOf('class="document')).toBeGreaterThan(html.indexOf('class="markdown"'));
    expect(html.indexOf('class="document')).toBeLessThan(html.indexOf('class="entity-side"'));
    const { documents, ...alone } = documentEntityPage;
    expect(documents).toHaveLength(2);
    expect(renderSlot("EntityPage", alone, defaultTheme)).not.toContain('class="document');
    expect(render({ documents: [] })).not.toContain('class="document');
  });

  it("folds a document that accompanies the note leading the page behind its summary line, the block whole inside, and leaves the others in full", () => {
    const summary = "Also available: threshold-review.pptx · Presentation · 4 pages";
    const html = render({ documents: [{ ...deck, summary }, transcript] });
    expectBalanced(html);
    expect(html).toContain(
      `<details class="document-fold"><summary>${summary}</summary><section class="document document-slide" aria-labelledby="document-1">`,
    );
    expect(html).toContain('<h2 id="document-1">Document <code>threshold-review.pptx</code></h2>');
    expect(html).toContain('</section></details><section class="document document-cue"');
    expect(count(html, 'class="document-fold"')).toBe(1);
    expect(html).not.toContain('<details class="document-fold" open');
    expect(render()).not.toContain("document-fold");
  });
});

describe("The viewer is loaded on demand, never in the page's initial bundle", () => {
  it("serves the opener as an island whose props name the viewer and worker bundles, the button hidden until its script runs", () => {
    const html = render();
    expect(count(html, '<concordance-island data-island="document-viewer"')).toBe(1);
    const match = /data-island="document-viewer" data-props="([^"]*)"/.exec(html);
    const props = JSON.parse((match?.[1] ?? "").replaceAll("&quot;", '"')) as {
      pdfHref: string;
      viewerHref: string;
      workerHref: string;
      labels: Record<string, string>;
    };
    expect(props.pdfHref).toBe("meetings/threshold-review.pdf");
    expect(props.viewerHref).toBe("../../../assets/viewer-pdf-00000000.js");
    expect(props.workerHref).toBe("../../../assets/viewer-pdf-worker-00000000.js");
    expect(props.labels).toEqual(viewerLabels("slide"));
    expect(html).toContain(
      '<button type="button" class="document-open" hidden>Open the viewer</button>',
    );
    expect(html).toContain('<div class="document-viewer" hidden></div>');
    // The bundles are named in the props only: no script or preload of the page loads them.
    expect(html).not.toContain('src="../../../assets/viewer-pdf');
    expect(html).not.toContain('href="../../../assets/viewer-pdf');
  });

  it("offers no opener when the build produced no viewer bundles or the document has no PDF", () => {
    const withoutBundles = render({
      documents: [{ ...deck, preview: { href: "meetings/threshold-review.pdf" } }],
    });
    expect(withoutBundles).not.toContain('data-island="document-viewer"');
    expect(withoutBundles).toContain('class="document-pdf"');
    const withoutPreview = render({ documents: [transcript] });
    expect(withoutPreview).not.toContain('data-island="document-viewer"');
    expect(withoutPreview).not.toContain('class="document-pdf"');
  });

  it("names the counter unit after the positions: slide for a deck, page for anything else", () => {
    expect(viewerLabels("slide").unit).toBe("slide");
    expect(viewerLabels("page").unit).toBe("page");
    expect(viewerLabels("cue").unit).toBe("page");
    expect(viewerLabels("page").openViewer).toBe("Open the viewer");
  });
});

describe("PNG thumbnails per slide, shown in a clickable rail", () => {
  it("draws the rail from the positions, each entry naming its slide with the first line of its text and leading to that text", () => {
    const html = render();
    expect(html).toContain('<nav class="document-rail" aria-label="Slides"><ol>');
    expect(html).toContain(
      '<li><a href="#L1" data-position="1"><span class="document-position">slide 1</span><span class="document-caption">Keyword page threshold review</span></a></li>',
    );
    expect(html).toContain(
      '<li><a href="#L3" data-position="3"><span class="document-position">slide 3</span></a></li>',
    );
    expect(html).toContain('<nav class="document-rail" aria-label="Cues"><ol>');
    expect(html).toContain('<span class="document-position">00:00:04</span>');
    expect(render({ documents: [{ ...deck, unit: "page" }] })).toContain('aria-label="Pages"');
  });

  it("cuts a long first line short and skips blank lines", () => {
    expect(positionCaption("  \n\nSecond line is the first with text\n")).toBe(
      "Second line is the first with text",
    );
    expect(positionCaption("x".repeat(80))).toBe(`${"x".repeat(59)}…`);
    expect(positionCaption("word ".repeat(20), 12)).toBe("word word w…");
    expect(positionCaption("")).toBe("");
    expect(positionAnchor(12)).toBe("L12");
    expect(positionAnchor(12, 1)).toBe("L12");
    expect(positionAnchor(12, 3)).toBe("L12-3");
  });
});

describe("Without JavaScript, a download link and the extracted text remain accessible", () => {
  it("serves the extracted text of every position in disclosure blocks anchored as the mentions cite them, the first one open", () => {
    const html = render();
    expect(html).toContain('<div class="document-text"><h3>Extracted text</h3>');
    expect(html).toContain(
      '<details id="L1" open><summary>slide 1</summary><p>Keyword page threshold review</p></details>',
    );
    expect(html).toContain('<details id="L2"><summary>slide 2</summary><p>Three occurrences');
    expect(html).toContain('<details id="L3"><summary>slide 3</summary><p></p></details>');
    // Two documents on one page: the anchors of the second carry its rank, so that ids stay unique.
    expect(count(html, '<details id="L1"')).toBe(1);
    expect(html).toContain(
      '<details id="L2-2"><summary>00:01:10</summary><p>The build summary will say so.</p>',
    );
    expect(html).toContain('<a href="#L1-2" data-position="1">');
  });

  it("says so when no text was extracted, and still offers the download", () => {
    const html = render({ documents: [{ ...deck, positions: [] }] });
    expect(html).toContain('<p class="empty">No text was extracted from this document.</p>');
    expect(html).not.toContain('class="document-rail"');
    expect(html).toContain('class="document-download"');
  });
});
