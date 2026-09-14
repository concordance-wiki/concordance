import { pagePath, type Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  centralDocument,
  documentPageLabels,
  documentPageOf,
  documentsOf,
  entityPageOf,
  formatSize,
  previewTwinOf,
} from "../../src/build/entity-page.js";
import type { EntityFragment, FragmentDocument } from "../../src/build/fragments.js";
import { datedBreadcrumbOf, datedSpaceOf, isDatedSpace } from "../../src/build/meeting.js";
import { breadcrumbOf, spaceOf } from "../../src/build/space.js";
import type { DocumentView } from "../../src/slots.js";
import { entity, fragments, model, profile, untyped } from "./fixture.js";

/** A framing space of dated decks: three of 2026 and one of 2025, one deck merged with its notes. */
const framingDeck = entity({
  id: "framing/transcript-publication-framing",
  type: "document",
  title: "Transcript publication framing",
  attributes: { date: "2026-03-12T09:30:00Z", format: "pptx" },
  source: {
    name: "framing",
    path: "transcript-publication-framing.md",
    line: 1,
    last_modified: "2026-03-14T10:00:00Z",
  },
  representations: [
    { path: "transcript-publication-framing.md", format: "markdown" },
    { path: "transcript-publication-framing.pptx", format: "pptx" },
  ],
});
const privacyDeck = entity({
  id: "framing/privacy-framing.pptx",
  type: "document",
  title: "Privacy framing",
  attributes: { date: "2026-02-20", format: "pptx" },
  source: { name: "framing", path: "decks/privacy-framing.pptx", line: 1 },
});
const roadmapNote = entity({
  id: "framing/roadmap-outline",
  type: "document",
  title: "Roadmap outline",
  attributes: { date: "2026-01-15" },
  source: { name: "framing", path: "roadmap-outline.md", line: 1 },
});
const visionDeck = entity({
  id: "framing/vision.pptx",
  type: "document",
  title: "Vision",
  attributes: { date: "2025-11-03", format: "pptx" },
  source: { name: "framing", path: "decks/vision.pptx", line: 1 },
});
const framing: Entity[] = [framingDeck, privacyDeck, roadmapNote, visionDeck];

const deckFragment: EntityFragment = {
  id: framingDeck.id,
  sections: [{ id: "notes", html: "<p>Notes of the workshop.</p>" }],
  text: "Notes of the workshop.",
  documents: [
    {
      source: "framing",
      path: "transcript-publication-framing.pptx",
      format: "pptx",
      target: `${framingDeck.id}/transcript-publication-framing.pptx`,
      preview: `${framingDeck.id}/transcript-publication-framing.pdf`,
      size: 4_200_000,
      author: "Participant-2",
      date: "2026-03-12T09:30:00Z",
      pageCount: 24,
      unit: "slide",
      pages: [
        { number: 1, label: "slide 1", text: "Transcript publication framing" },
        { number: 2, label: "slide 2", text: "Why publish transcripts" },
      ],
    },
  ],
};

/** The entities of the fixture model outside the framing space, which the decks above make up. */
const others = model().entities.filter((candidate) => candidate.source.name !== "framing");

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model({ entities: [...others, ...framing] }),
    profile,
    catalogue: loadCatalogue("en"),
    fragments: new Map([...fragments, [framingDeck.id, deckFragment]]),
    ...overrides,
  });
}

const page = pagePath(framingDeck.id);

describe("The space of a document page is folded by year and month when every page of it is dated", () => {
  it("draws the tree and the breadcrumb of a deck as those of a meeting, the folder tree for an undated space or for a note", () => {
    const props = entityPageOf(context(), framingDeck);
    expect(props.space).toEqual(datedSpaceOf(context(), page, framingDeck));
    expect(props.space?.nodes).toEqual([
      {
        label: "2026",
        count: 3,
        href: "../2026/index.html",
        children: [
          {
            label: "March",
            count: 1,
            href: "../2026/03/index.html",
            children: [{ label: "Transcript publication framing", current: true }],
          },
          { label: "February", count: 1, href: "../2026/02/index.html" },
          { label: "January", count: 1, href: "../2026/01/index.html" },
        ],
      },
      { label: "2025", count: 1, href: "../2025/index.html" },
    ]);
    expect(props.breadcrumb).toEqual([
      { label: "framing", href: "../index.html" },
      { label: "March 2026", href: "../2026/03/index.html" },
      { label: "Transcript publication framing" },
    ]);
    // One deck without a date: the folder tree stays.
    const undated = context({
      model: model({
        entities: [
          ...others,
          ...framing.map((candidate) =>
            candidate === visionDeck ? { ...candidate, attributes: {} } : candidate,
          ),
        ],
      }),
    });
    expect(isDatedSpace(undated, "framing")).toBe(false);
    const folders = entityPageOf(undated, framingDeck);
    expect(folders.space).toEqual(spaceOf(undated, page, framingDeck));
    expect(folders.space?.nodes).toEqual([
      { label: "decks", count: 2, href: "../decks/index.html" },
      { label: "Roadmap outline", href: "../roadmap-outline/index.html" },
      { label: "Transcript publication framing", current: true },
    ]);
    expect(folders.breadcrumb).toEqual(breadcrumbOf(undated, page, framingDeck));
    // A note of the dated space is not a document page: it keeps the folder tree.
    const note = entityPageOf(context(), roadmapNote);
    expect(note.document).toBeUndefined();
    expect(note.space).toEqual(spaceOf(context(), pagePath(roadmapNote.id), roadmapNote));
  });
});

/** The PDF kept next to the deck in the sources, read as a file of its own: copied where the deck's preview is. */
const pdfTwin: FragmentDocument = {
  source: "framing",
  path: "transcript-publication-framing.pdf",
  format: "pdf",
  target: `${framingDeck.id}/transcript-publication-framing.pdf`,
  preview: `${framingDeck.id}/transcript-publication-framing.pdf`,
  size: 6_100_000,
  author: "Converter",
  date: "2026-03-13T08:00:00Z",
  pageCount: 24,
  unit: "page",
  pages: [
    { number: 1, label: "page 1", text: "Transcript publication framing" },
    { number: 2, label: "page 2", text: "Why publish transcripts, as printed" },
  ],
};

const [deckDocument] = deckFragment.documents ?? [];
if (deckDocument === undefined) throw new Error("the fixture carries the deck");

/** The deck of the fixture with the PDF twin among its documents, in path order: the PDF first. */
function withTwin(documents: FragmentDocument[]): SiteContext {
  return context({
    fragments: new Map([...fragments, [framingDeck.id, { ...deckFragment, documents }]]),
  });
}

describe("documentsOf folds the PDF twin of a converted file into one document", () => {
  it("finds the twin of a converted file among the documents at its preview target, none for a PDF, a transcript or a file whose PDF the build produced", () => {
    const transcript: FragmentDocument = {
      source: "framing",
      path: "transcript-publication-framing.vtt",
      format: "vtt",
      target: `${framingDeck.id}/transcript-publication-framing.vtt`,
      unit: "cue",
      pages: [],
    };
    const all = [pdfTwin, deckDocument, transcript];
    expect(previewTwinOf(deckDocument, all)).toBe(pdfTwin);
    expect(previewTwinOf(pdfTwin, all)).toBeUndefined();
    expect(previewTwinOf(transcript, all)).toBeUndefined();
    expect(previewTwinOf(deckDocument, [deckDocument, transcript])).toBeUndefined();
  });

  it("offers the original to download and the PDF as its preview with what its reader read, in the place of the original, the positions of the original", () => {
    const documents = documentsOf(withTwin([pdfTwin, deckDocument]), page, framingDeck, {
      viewer: "assets/viewer-pdf-00000000.js",
      worker: "assets/viewer-pdf-worker-00000000.js",
    });
    expect(documents).toEqual([
      {
        file: {
          label: "transcript-publication-framing.pptx",
          href: "transcript-publication-framing.pptx",
          format: "pptx",
        },
        preview: {
          href: "transcript-publication-framing.pdf",
          viewerHref: "../../assets/viewer-pdf-00000000.js",
          workerHref: "../../assets/viewer-pdf-worker-00000000.js",
          size: 6_100_000,
          pageCount: 24,
          author: "Converter",
          date: "2026-03-13T08:00:00Z",
        },
        unit: "slide",
        positions: [
          { number: 1, label: "slide 1", text: "Transcript publication framing" },
          { number: 2, label: "slide 2", text: "Why publish transcripts" },
        ],
        size: 4_200_000,
        author: "Participant-2",
        date: "2026-03-12T09:30:00Z",
        pageCount: 24,
      },
    ]);
  });

  it("takes the pages of the PDF, and their unit, when the reader of the original gave no text, and carries no property the PDF does not state", () => {
    const { size, author, date, pageCount, ...bareTwin } = pdfTwin;
    expect([size, author, date, pageCount]).toEqual([
      6_100_000,
      "Converter",
      "2026-03-13T08:00:00Z",
      24,
    ]);
    const [merged] = documentsOf(
      withTwin([bareTwin, { ...deckDocument, pages: [] }]),
      page,
      framingDeck,
    );
    expect(merged?.unit).toBe("page");
    expect(merged?.positions.map((position) => position.label)).toEqual(["page 1", "page 2"]);
    expect(merged?.positionsFromPreview).toBe(true);
    expect(merged?.preview).toEqual({ href: "transcript-publication-framing.pdf" });
    const [alone] = documentsOf(withTwin([{ ...deckDocument, pages: [] }]), page, framingDeck);
    expect(alone?.unit).toBe("slide");
    expect(alone?.positions).toEqual([]);
    expect(alone).not.toHaveProperty("positionsFromPreview");
  });

  it("keeps a PDF that is its own preview as a document of its own", () => {
    const documents = documentsOf(withTwin([pdfTwin]), page, framingDeck);
    expect(documents.map((document) => document.file.format)).toEqual(["pdf"]);
    expect(documents[0]?.preview).toEqual({ href: "transcript-publication-framing.pdf" });
    expect(documents[0]?.pageCount).toBe(24);
  });
});

describe("The document page view model", () => {
  it("carries the size and the properties the reader exposed on every document of the page", () => {
    const [deck] = documentsOf(context(), page, framingDeck);
    expect(deck).toMatchObject({
      size: 4_200_000,
      author: "Participant-2",
      date: "2026-03-12T09:30:00Z",
      pageCount: 24,
    });
    const older: EntityFragment = {
      ...deckFragment,
      documents: (deckFragment.documents ?? []).map(
        ({ source, path, format, target, preview, unit, pages }) => ({
          source,
          path,
          format,
          target,
          ...(preview === undefined ? {} : { preview }),
          unit,
          pages,
        }),
      ),
    };
    const [plain] = documentsOf(
      context({ fragments: new Map([...fragments, [framingDeck.id, older]]) }),
      page,
      framingDeck,
    );
    expect(plain).toBeDefined();
    expect(plain).not.toHaveProperty("size");
    expect(plain).not.toHaveProperty("author");
    expect(plain).not.toHaveProperty("date");
    expect(plain).not.toHaveProperty("pageCount");
  });

  it("words the kind, the count, the size, the date read from the file and the author, and lists the three files", () => {
    const props = entityPageOf(context(), framingDeck);
    expect(props.document).toEqual({
      kind: "Presentation",
      pages: 2,
      pagesLabel: "2 pages",
      size: "4.2 MB",
      date: { date: "2026-03-12", label: "March 12, 2026", fromFile: true },
      author: "Participant-2",
      files: [
        { label: ".pptx", role: "original", href: "transcript-publication-framing.pptx" },
        { label: ".pdf", role: "preview", href: "transcript-publication-framing.pdf" },
        {
          label: "transcript-publication-framing.md",
          role: "session notes",
          href: "#document-notes",
        },
      ],
      labels: documentPageLabels(context(), 3, 2),
    });
    expect(props.document?.labels).toMatchObject({
      document: "Document",
      extractedText: "Extracted text",
      relatedNotes: "Related notes",
      downloadOriginal: "Download the original",
      sameDocument: "Same document, 3 files",
      dateNote: "Read from the file, distinct from the repository date.",
    });
    expect(documentPageLabels(context(), 1).sameDocument).toBe("Same document, one file");
    expect(props.breadcrumb).toEqual(datedBreadcrumbOf(context(), page, framingDeck));
  });

  it("words the same page in French", () => {
    const french = context({ catalogue: loadCatalogue("fr"), locale: "fr" });
    expect(entityPageOf(french, framingDeck).document).toMatchObject({
      kind: "Présentation",
      size: "4,2\u202fMo",
      date: { label: "12 mars 2026" },
      labels: { sameDocument: "Même document, 3 fichiers", relatedNotes: "Notes associées" },
    });
  });

  it("falls back to the count the file states, the date of the repository and no note, and names another format by its extension", () => {
    const { representations, ...alone } = framingDeck;
    expect(representations).toHaveLength(2);
    const bare: FragmentDocument = {
      source: "framing",
      path: "transcript-publication-framing.pptx",
      format: "odg",
      target: `${framingDeck.id}/transcript-publication-framing.pptx`,
      pageCount: 24,
      unit: "slide",
      pages: [],
    };
    const withDocument = (document: FragmentDocument): Map<string, EntityFragment> =>
      new Map([...fragments, [framingDeck.id, { ...deckFragment, documents: [document] }]]);
    const props = entityPageOf(context({ fragments: withDocument(bare) }), alone);
    expect(props.document).toEqual({
      kind: "ODG",
      pages: 24,
      pagesLabel: "24 pages",
      date: { date: "2026-03-14", label: "March 14, 2026", fromFile: false },
      files: [{ label: ".odg", role: "original", href: "transcript-publication-framing.pptx" }],
      labels: documentPageLabels(context(), 1, 24),
    });
    const { pageCount, ...counted } = bare;
    expect(pageCount).toBe(24);
    const { last_modified, ...source } = alone.source;
    expect(last_modified).toBeDefined();
    const nothing = entityPageOf(context({ fragments: withDocument(counted) }), {
      ...alone,
      source,
    });
    expect(nothing.document).toEqual({
      kind: "ODG",
      files: [{ label: ".odg", role: "original", href: "transcript-publication-framing.pptx" }],
      labels: documentPageLabels(context(), 1),
    });
  });

  it("reads from the PDF preview the count, the size, the date and the author the original does not give, and says so for the count and the size", () => {
    const { size, author, date, pageCount, ...bareDeck } = deckDocument;
    expect([size, author, date, pageCount]).toEqual([
      4_200_000,
      "Participant-2",
      "2026-03-12T09:30:00Z",
      24,
    ]);
    const everything = entityPageOf(
      withTwin([pdfTwin, { ...bareDeck, pages: [] }]),
      framingDeck,
    ).document;
    expect(everything).toMatchObject({
      kind: "Presentation",
      pages: 2,
      pagesLabel: "2 pages",
      size: "6.1 MB",
      date: { date: "2026-03-13", label: "March 13, 2026", fromFile: true },
      author: "Converter",
      fromPreview: true,
    });
    expect(everything?.files.slice(0, 2)).toEqual([
      { label: ".pptx", role: "original", href: "transcript-publication-framing.pptx" },
      { label: ".pdf", role: "preview", href: "transcript-publication-framing.pdf" },
    ]);
    // The original gives its pages and nothing else: the size alone comes from the preview.
    const sized = entityPageOf(withTwin([pdfTwin, bareDeck]), framingDeck).document;
    expect(sized).toMatchObject({ pages: 2, size: "6.1 MB", fromPreview: true });
    // The original gives everything: nothing comes from the preview, and the page says nothing.
    const own = entityPageOf(withTwin([pdfTwin, deckDocument]), framingDeck).document;
    expect(own).toMatchObject({ pages: 2, size: "4.2 MB", author: "Participant-2" });
    expect(own).not.toHaveProperty("fromPreview");
    // The original states its count without any text: the count is its own, the pages of the preview shown.
    const counted = entityPageOf(
      withTwin([pdfTwin, { ...bareDeck, pages: [], pageCount: 24 }]),
      framingDeck,
    ).document;
    expect(counted).toMatchObject({ pages: 24, size: "6.1 MB", fromPreview: true });
    // A preview stating nothing gives nothing but its pages, counted as its own.
    const {
      size: twinSize,
      author: twinAuthor,
      date: twinDate,
      pageCount: twinCount,
      ...bareTwin
    } = pdfTwin;
    expect([twinSize, twinAuthor, twinDate, twinCount]).toEqual([
      6_100_000,
      "Converter",
      "2026-03-13T08:00:00Z",
      24,
    ]);
    const nothing = entityPageOf(
      withTwin([bareTwin, { ...bareDeck, pages: [] }]),
      framingDeck,
    ).document;
    expect(nothing).toMatchObject({
      kind: "Presentation",
      pages: 2,
      date: { date: "2026-03-14", fromFile: false },
      fromPreview: true,
    });
    expect(nothing).not.toHaveProperty("size");
    expect(nothing).not.toHaveProperty("author");
  });

  it("lists a PDF that is its own preview once among the files", () => {
    const props = entityPageOf(withTwin([pdfTwin]), framingDeck);
    expect(props.document?.kind).toBe("PDF");
    expect(props.document?.files).toEqual([
      { label: ".pdf", role: "original", href: "transcript-publication-framing.pdf" },
      {
        label: "transcript-publication-framing.md",
        role: "session notes",
        href: "#document-notes",
      },
    ]);
    expect(props.document?.labels?.sameDocument).toBe("Same document, 2 files");
  });

  it("lays out no document page for a note alone, a transcript, or a deck accompanied by a transcript", () => {
    expect(entityPageOf(context(), untyped).document).toBeUndefined();
    const deck: DocumentView = {
      file: { label: "a.pptx", href: "a.pptx", format: "pptx" },
      unit: "slide",
      positions: [],
    };
    const transcript: DocumentView = {
      file: { label: "a.vtt", href: "a.vtt", format: "vtt" },
      unit: "cue",
      positions: [],
    };
    expect(centralDocument([deck])).toBe(deck);
    expect(centralDocument([transcript])).toBeUndefined();
    expect(centralDocument([deck, transcript])).toBeUndefined();
    expect(centralDocument([])).toBeUndefined();
    expect(documentPageOf(context(), framingDeck, [deck, transcript])).toBeUndefined();
  });

  it("formats a size in the unit that reads best", () => {
    expect(formatSize("en", 512)).toBe("0.5 kB");
    expect(formatSize("en", 312_000)).toBe("312 kB");
    expect(formatSize("en", 4_200_000)).toBe("4.2 MB");
    expect(formatSize("en", 2_500_000_000)).toBe("2.5 GB");
    expect(formatSize("fr", 4_200_000)).toBe("4,2\u202fMo");
  });
});
