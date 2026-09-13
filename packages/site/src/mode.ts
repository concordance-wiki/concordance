/** The `localStorage` key holding the reader's choice of colour scheme; absent when the site's default applies. */
export const MODE_STORAGE_KEY = "concordance-mode";

/** The choices of the mode switch, in the order it cycles through them; `system` means no stored choice. */
export const MODES = ["system", "light", "dark"] as const;

/** A colour scheme a reader can force; `system` leaves the theme's default and the system preference in charge. */
export type ModeChoice = (typeof MODES)[number];

/** The glyph the mode switch draws for each choice: a half disc for the system preference, a sun, a moon. */
export const MODE_GLYPHS: Readonly<Record<ModeChoice, string>> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/** The accessible name of the mode switch: the name of the control, then the current choice. */
export function modeSwitchName(name: string, choice: string): string {
  return `${name}: ${choice}`;
}

/**
 * The only inline script of a page: it applies the stored choice to `data-mode` on the root
 * before the first paint, so that a reader who chose a scheme never sees the other one flash.
 * It is a constant, so a content security policy can allow it by hash; without it, and without
 * JavaScript, the theme's default and the system preference apply.
 */
export const MODE_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});if(m==="light"||m==="dark")document.documentElement.dataset.mode=m}catch(e){}})()`;
