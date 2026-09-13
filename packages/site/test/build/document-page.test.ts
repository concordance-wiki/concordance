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
        children: [
          {
            label: "March",
            count: 1,
            children: [{ label: "Transcript publication framing", current: true }],
          },
          { label: "February", count: 1 },
          { label: "January", count: 1 },
        ],
      },
      { label: "2025", count: 1 },
    ]);
    expect(props.breadcrumb).toEqual([
      { label: "framing", href: "../index.html" },
      { label: "March 2026" },
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
      labels: documentPageLabels(context(), 3),
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
      labels: documentPageLabels(context(), 1),
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
