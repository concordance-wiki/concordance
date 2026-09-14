import { GALLERY_WIDTHS, type GalleryWidth } from "./page.js";

/** One of the three buttons of the switch, carrying the width it sets in `data-width`. */
export interface WidthButton {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
}

/** The group holding the buttons, served hidden until the switch is wired. */
export interface WidthGroup {
  hidden: boolean;
  querySelectorAll(selector: string): Iterable<WidthButton>;
}

/** The island element written at build, holding the group. */
export interface WidthElement {
  querySelector(selector: string): WidthGroup | null;
}

/** A frame of the index, whose `width` attribute the switch rewrites. */
export interface WidthFrame {
  setAttribute(name: string, value: string): void;
}

/** The document, where the frames of every state are looked up. */
export interface WidthHost {
  querySelectorAll(selector: string): Iterable<WidthFrame>;
}

/** The selector of the frames the switch resizes: every state of the index is framed by one. */
export const FRAME_SELECTOR = "iframe.gallery-frame";

function isWidth(value: number): value is GalleryWidth {
  // The list is a tuple of numbers: a number found in it is one of them.
  return (GALLERY_WIDTHS as readonly number[]).includes(value);
}

/** The width a button sets, read from its attribute; none when the attribute is not one of the widths. */
export function widthOf(button: WidthButton): GalleryWidth | undefined {
  const value = Number(button.getAttribute("data-width"));
  return isWidth(value) ? value : undefined;
}

/**
 * Reveals the group of one island and makes each button set every frame of the document to its
 * width, the pressed button saying which; no button is pressed until one is, each frame keeping
 * the width of its board.
 */
export function wireWidthSwitch(element: WidthElement, host: WidthHost): boolean {
  const group = element.querySelector(".gallery-widths");
  if (group === null) {
    return false;
  }
  const buttons = [...group.querySelectorAll("button")];
  for (const button of buttons) {
    const width = widthOf(button);
    if (width === undefined) continue;
    button.addEventListener("click", () => {
      for (const frame of host.querySelectorAll(FRAME_SELECTOR)) {
        frame.setAttribute("width", String(width));
      }
      for (const other of buttons) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      }
    });
  }
  group.hidden = false;
  return true;
}
