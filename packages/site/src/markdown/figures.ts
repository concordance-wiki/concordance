/** Class of the figure an image of the sources stands in, when it holds a paragraph of its own. */
export const FIGURE_CLASS = "figure";
/** Class of the caption of a figure: the alternative text of the image, as the author wrote it. */
export const FIGURE_CAPTION_CLASS = "figure-caption";
/** Class of the path of the file of a figure in its repository, the last line of its caption. */
export const FIGURE_PATH_CLASS = "figure-path";
/** Class of the note a theme sets before the path, saying what the image is. */
export const FIGURE_NOTE_CLASS = "figure-note";

const FIGURE_PATH_OPENING = `<code class="${FIGURE_PATH_CLASS}">`;

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Sets the note of a theme under every figure of a rendered section, before the path of the
 * file: the renderer leaves the caption and the path, which say nothing of the language of the
 * site, and the theme words what the image is. The opening of the path is the renderer's own
 * markup; a note never writes it, since its raw HTML is dropped and its code spans carry no class.
 */
export function withImageNotes(html: string, note: string): string {
  return html.replaceAll(
    FIGURE_PATH_OPENING,
    `<span class="${FIGURE_NOTE_CLASS}">${escapeText(note)}</span>${FIGURE_PATH_OPENING}`,
  );
}
