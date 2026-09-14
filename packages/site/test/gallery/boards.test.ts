import { describe, expect, it } from "vitest";

import { GALLERY_BOARDS, screenNoteHref, type GalleryBoard } from "../../src/gallery/boards.js";
import { galleryPages } from "../../src/gallery/pages.js";

const BOARD_IDS = GALLERY_BOARDS.map((board) => board.id);

describe("The gallery has one state per board of the reference design, named after it", () => {
  it("lists the boards in their order, then the to-do page, the panels and the chrome", () => {
    expect(BOARD_IDS).toEqual([
      ...Array.from({ length: 16 }, (_, index) => `B${String(index + 1)}`),
      "B18",
      "B19",
      "B20",
      "todo",
      "panels",
      "chrome",
    ]);
  });

  it("files every state under a board, and every board but the accessibility one has a state in the corporate chrome, the chrome group showing its other shapes", () => {
    for (const page of galleryPages) {
      expect(BOARD_IDS, page.file).toContain(page.board);
    }
    const corporate = new Map<string, string[]>();
    for (const page of galleryPages) {
      if (page.header.siteTitle === "Concordance documentation") {
        corporate.set(page.board, [...(corporate.get(page.board) ?? []), page.file]);
      }
    }
    expect([...corporate.keys()].sort()).toEqual(
      BOARD_IDS.filter((id) => id !== "B4" && id !== "chrome").sort(),
    );
    expect(corporate.get("B9")).toEqual([
      "entity-page-phone.html",
      "entity-page-drawer.html",
      "entity-page-tablet.html",
    ]);
    expect(corporate.get("B20")).toEqual(["entity-page-dark.html", "home-dark.html"]);
  });

  it("forces the dark scheme on the states of the dark board alone", () => {
    const forced = galleryPages.filter((page) => page.scheme !== undefined);
    expect(forced.map((page) => [page.file, page.scheme, page.board])).toEqual([
      ["entity-page-dark.html", "dark", "B20"],
      ["home-dark.html", "dark", "B20"],
    ]);
  });

  it("orders the states by board, so that the page set reads as the boards do", () => {
    const order = galleryPages.map((page) => BOARD_IDS.indexOf(page.board));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("declares the width of its board on the narrow states only", () => {
    const widths = Object.fromEntries(
      galleryPages
        .filter((page) => page.width !== undefined)
        .map((page) => [page.file, page.width]),
    );
    expect(widths).toEqual({
      "entity-page-phone.html": 390,
      "entity-page-drawer.html": 390,
      "entity-page-tablet.html": 834,
    });
  });

  it("links every board with a page to the screen note of the demonstration, at its address", () => {
    const linked = GALLERY_BOARDS.filter(
      (board): board is GalleryBoard & { screen: string } => board.screen !== undefined,
    );
    // The accessibility board has no page of its own, nor does the footer, seen on every page.
    expect(linked.map((board) => board.id)).toEqual(
      BOARD_IDS.filter((id) => id !== "B4" && id !== "B18" && id !== "chrome"),
    );
    for (const board of linked) {
      expect(screenNoteHref(board)).toBe(
        `https://concordance-wiki.github.io/demo-wiki/specs/screens/${board.screen}/`,
      );
      expect(board.screen).toMatch(/^(pages|panels)\/[a-z-]+$/);
    }
    expect(screenNoteHref({ id: "B4", title: "Accessibility", caption: "" })).toBeUndefined();
  });
});
