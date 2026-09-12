import { describe, expect, it } from "vitest";

import { A11Y_RULES, checkAccessibility, type A11yRule } from "../../src/a11y/check.js";

/** A minimal page that passes every rule; `body` replaces the main content, `extra` is appended to the body. */
function page(main = "<h1>Title</h1><p>Text</p>", extra = ""): string {
  return [
    "<!doctype html>",
    '<html lang="en" dir="ltr"><head><meta charset="utf-8"/><title>T</title></head><body>',
    '<a class="skip-link" href="#main">Skip to content</a>',
    '<header><nav aria-label="Site"><a href="../">Home</a></nav></header>',
    `<main id="main">${main}</main>`,
    "<footer><p>version 1</p></footer>",
    extra,
    "</body></html>",
  ].join("");
}

function rules(html: string): A11yRule[] {
  return checkAccessibility(html).map((finding) => finding.rule);
}

describe("checkAccessibility", () => {
  it("names its rules and finds nothing on a sound page", () => {
    expect(A11Y_RULES).toEqual([
      "html-lang",
      "single-h1",
      "heading-order",
      "img-alt",
      "control-label",
      "landmarks",
      "link-text",
      "unique-id",
      "skip-link",
    ]);
    expect(checkAccessibility(page())).toEqual([]);
  });

  describe("html-lang", () => {
    it("requires a lang attribute on the html element, non-empty", () => {
      expect(checkAccessibility(page().replace('lang="en" ', ""))).toEqual([
        { rule: "html-lang", message: "the html element carries no lang attribute" },
      ]);
      expect(rules(page().replace('lang="en"', 'lang=" "'))).toEqual(["html-lang"]);
      expect(rules("<main id=main><h1>No document</h1></main>")).toContain("html-lang");
    });
  });

  describe("single-h1", () => {
    it("counts the h1 elements and wants exactly one", () => {
      expect(checkAccessibility(page("<h1>A</h1><h1>B</h1>"))).toEqual([
        { rule: "single-h1", message: "2 h1 elements, expected one" },
      ]);
      expect(checkAccessibility(page("<h2>Only</h2>"))).toEqual([
        { rule: "single-h1", message: "0 h1 elements, expected one" },
        { rule: "heading-order", message: 'h2 "Only" follows no heading' },
      ]);
    });
  });

  describe("heading-order", () => {
    it("accepts a level going down by one or up by any number", () => {
      expect(
        checkAccessibility(page("<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2><h1>E</h1>")),
      ).toEqual([{ rule: "single-h1", message: "2 h1 elements, expected one" }]);
    });

    it("reports a skipped level with the heading text", () => {
      expect(checkAccessibility(page("<h1>A</h1><h3>Skipped <em>one</em></h3>"))).toEqual([
        { rule: "heading-order", message: 'h3 "Skipped one" follows h1' },
      ]);
    });
  });

  describe("img-alt", () => {
    it("wants an alt attribute on every image, empty allowed", () => {
      expect(
        checkAccessibility(page('<h1>A</h1><img src="a.png" alt=""><img src="b.png" alt="B"/>')),
      ).toEqual([]);
      expect(checkAccessibility(page('<h1>A</h1><img src="a.png"><img>'))).toEqual([
        { rule: "img-alt", message: '<img src="a.png"> has no alt attribute' },
        { rule: "img-alt", message: '<img src=""> has no alt attribute' },
      ]);
    });
  });

  describe("control-label", () => {
    it("accepts a label for the control, an aria-label, an aria-labelledby or a button text", () => {
      const html = page(
        '<h1>A</h1><label for="q">Query</label><input id="q" type="search">' +
          '<select aria-label="Type"></select><textarea aria-labelledby="q"></textarea>' +
          '<button type="submit">Go</button><input type="hidden" name="t">' +
          '<input type="submit" value="Send">',
      );
      expect(checkAccessibility(html)).toEqual([]);
    });

    it("reports every unlabelled control with its id when it has one", () => {
      const html = page(
        '<h1>A</h1><input id="q"><select></select><textarea></textarea><button type="button"></button>' +
          '<label for="other">Other</label><input aria-label=" ">',
      );
      expect(checkAccessibility(html)).toEqual([
        { rule: "control-label", message: '<input id="q"> has no label' },
        { rule: "control-label", message: "<select> has no label" },
        { rule: "control-label", message: "<textarea> has no label" },
        { rule: "control-label", message: "<button> has no label" },
        { rule: "control-label", message: "<input> has no label" },
      ]);
    });
  });

  describe("landmarks", () => {
    it("wants a main, a nav, a header and a footer, and refuses a second main", () => {
      expect(
        checkAccessibility(
          '<html lang="en"><body><a href="#main">Skip</a><div id="main"><h1>A</h1></div></body></html>',
        ),
      ).toEqual([
        { rule: "landmarks", message: "no main landmark" },
        { rule: "landmarks", message: "no nav landmark" },
        { rule: "landmarks", message: "no header landmark" },
        { rule: "landmarks", message: "no footer landmark" },
      ]);
      expect(checkAccessibility(page("<h1>A</h1>", "<main><p>Again</p></main>"))).toEqual([
        { rule: "landmarks", message: "2 main landmarks, expected one" },
      ]);
    });
  });

  describe("link-text", () => {
    it("accepts text, an aria-label, an aria-labelledby or an image alternative as the name of a link", () => {
      const html = page(
        '<h1>A</h1><a href="1">One</a><a href="2" aria-label="Two"></a>' +
          '<a href="3" aria-labelledby="main"></a><a href="4"><img src="i.png" alt="Four"></a>',
      );
      expect(checkAccessibility(html)).toEqual([]);
    });

    it("reports a link without any name, whatever its href, and leaves anchors alone", () => {
      const html = page(
        '<h1>A</h1><a href="x"> &nbsp; </a><a href=""><span></span></a><a href="i"><img src="i.png" alt=""></a><a id="anchor"></a>' +
          '<a href="n"><img src="n.png"></a>',
      );
      expect(checkAccessibility(html)).toEqual([
        { rule: "img-alt", message: '<img src="n.png"> has no alt attribute' },
        { rule: "link-text", message: '<a href="x"> has no text' },
        { rule: "link-text", message: '<a href=""> has no text' },
        { rule: "link-text", message: '<a href="i"> has no text' },
        { rule: "link-text", message: '<a href="n"> has no text' },
      ]);
    });
  });

  describe("unique-id", () => {
    it("reports an id used more than once, once per extra use", () => {
      expect(
        checkAccessibility(page('<h1 id="t">A</h1><p id="t">B</p><p id="t">C</p><p id="u">D</p>')),
      ).toEqual([
        { rule: "unique-id", message: 'id "t" is used more than once' },
        { rule: "unique-id", message: 'id "t" is used more than once' },
      ]);
    });
  });

  describe("skip-link", () => {
    it("wants the first focusable element to be a link to an existing fragment", () => {
      const noSkip = page().replace('<a class="skip-link" href="#main">Skip to content</a>', "");
      expect(checkAccessibility(noSkip)).toEqual([
        { rule: "skip-link", message: "the first focusable element is <a>" },
      ]);
      const dangling = page().replace('href="#main"', 'href="#content"');
      expect(checkAccessibility(dangling)).toEqual([
        { rule: "skip-link", message: "the skip link points at #content, which does not exist" },
      ]);
    });

    it("recognises buttons, fields, tabindex and links with an href as focusable, and nothing else", () => {
      const before = (element: string): string =>
        page("<h1>A</h1>").replace('<a class="skip-link"', `${element}<a class="skip-link"`);
      expect(rules(before('<button aria-label="Menu" id="menu"></button>'))).toEqual(["skip-link"]);
      expect(checkAccessibility(before('<button aria-label="Menu" id="menu"></button>'))).toEqual([
        { rule: "skip-link", message: 'the first focusable element is <button id="menu">' },
      ]);
      expect(rules(before('<input type="search" aria-label="Query">'))).toEqual(["skip-link"]);
      expect(rules(before('<select aria-label="Type"></select>'))).toEqual(["skip-link"]);
      expect(rules(before('<textarea aria-label="Note"></textarea>'))).toEqual(["skip-link"]);
      expect(rules(before('<div tabindex="0">Widget</div>'))).toEqual(["skip-link"]);
      expect(rules(before('<a id="anchor"></a><input type="hidden"><span>Text</span>'))).toEqual(
        [],
      );
    });

    it("finds nothing on a page without any focusable element", () => {
      const html =
        '<html lang="en"><body><header></header><nav></nav><main><h1>A</h1></main><footer></footer></body></html>';
      expect(checkAccessibility(html)).toEqual([]);
    });
  });

  describe("parsing", () => {
    it("reads attributes with double, single or no quotes and boolean attributes, whatever the case", () => {
      const html = page(
        '<h1>A</h1><IMG SRC=a.png ALT=\'A\'><input type=hidden name=t disabled><script type="module" defer src="x.js"></script>',
      );
      expect(checkAccessibility(html)).toEqual([]);
    });

    it("tolerates a closing tag that was never opened and an element left open", () => {
      const html = page("<h1>A</h1></section><section><p>Open");
      expect(checkAccessibility(html)).toEqual([]);
    });

    it("keeps the text after the last tag and before the first one out of the elements", () => {
      expect(checkAccessibility(`prologue${page()}epilogue`)).toEqual([]);
    });
  });
});
