import type { PageSlot } from "../render.js";
import type { SlotName, SlotProps } from "../slots.js";
import { footer, header } from "./fixtures/chrome.js";

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
    locale: string;
    props: SlotProps[S];
    header: SlotProps["Header"];
    footer: SlotProps["Footer"];
  };
}[PageSlot];

/** The chrome of a state that names no other: the English locale, the plain header and footer. */
export const chrome = { locale: "en", header, footer } as const;
