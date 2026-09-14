import type { ColourScheme } from "./css/tokens.js";

/** The `localStorage` key holding the reader's choice of colour scheme; absent when the site's default applies. */
export const MODE_STORAGE_KEY = "concordance-mode";

/** The choices a reader can hold: the two schemes, or `system` when no choice is stored. */
export const MODES = ["system", "light", "dark"] as const;

/** A colour scheme a reader can force; `system` leaves the theme's default and the system preference in charge. */
export type ModeChoice = (typeof MODES)[number];

/** The glyph of each scheme: a sun, a moon. The switch draws the glyph of the scheme it switches to. */
export const SCHEME_GLYPHS: Readonly<Record<ColourScheme, string>> = {
  light: "☀",
  dark: "☾",
};

/** The scheme the other one is: what the switch offers from the one displayed. */
export function otherScheme(scheme: ColourScheme): ColourScheme {
  return scheme === "dark" ? "light" : "dark";
}

/** The glyph the switch draws over a page in the given scheme: a moon over a light page, a sun over a dark one. */
export function switchGlyph(displayed: ColourScheme): string {
  return SCHEME_GLYPHS[otherScheme(displayed)];
}

/**
 * The only inline script of a page: it applies the stored choice to `data-mode` on the root
 * before the first paint, so that a reader who chose a scheme never sees the other one flash.
 * It is a constant, so a content security policy can allow it by hash; without it, and without
 * JavaScript, the theme's default and the system preference apply.
 */
export const MODE_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});if(m==="light"||m==="dark")document.documentElement.dataset.mode=m}catch(e){}})()`;
