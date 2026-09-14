import type { PageSlot } from "../render.js";
import type { SlotName, SlotProps } from "../slots.js";
import type { GalleryBoardId } from "./boards.js";
import { footer, header } from "./fixtures/chrome.js";

/** The widths the boards of the reference design are drawn at: a phone, a tablet, a desktop. */
export const GALLERY_WIDTHS = [390, 834, 1440] as const;

export type GalleryWidth = (typeof GALLERY_WIDTHS)[number];

/** The width of a state that declares none: the desktop of the boards. */
export const DEFAULT_GALLERY_WIDTH: GalleryWidth = 1440;

/** One page of the gallery: a slot in one state, rendered through the theme with fixture data. */
export type GalleryPage = {
  [S in PageSlot]: {
    /** File name under the output folder. */
    file: string;
    /** The slot the page demonstrates; the chrome slots are seen on every page and get one variant each. */
    slot: SlotName;
    /** The page slot handed to the renderer; a panel is framed under a heading, a chrome slot shows the to-do page. */
    rendered: S;
    state: string;
    description: string;
    /** The board of the reference design the state stands for; the index groups the states by it. */
    board: GalleryBoardId;
    /** The width the index frames the state at, that of its board; the desktop when absent. */
    width?: GalleryWidth;
    /** `false` serves the page without the scripts of its islands: what a reader without JavaScript gets. */
    scripts?: false;
    locale: string;
    props: SlotProps[S];
    header: SlotProps["Header"];
    footer: SlotProps["Footer"];
  };
}[PageSlot];

/** The chrome of a state that names no other: the English locale, the plain header and footer. */
export const chrome = { locale: "en", header, footer } as const;
