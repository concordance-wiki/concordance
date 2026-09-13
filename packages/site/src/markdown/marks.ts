import { formatMessage, loadCatalogue } from "@concordance-wiki/i18n";

/**
 * What a mark of the text tells on hover and to assistive technology, worded in the site
 * language: the build sets it on every recognised word when it renders the fragments, before
 * any page exists.
 */
export interface MarkLabels {
  /** On a recognised word whose entity has a note: "note: <title>". */
  note: (title: string) => string;
  /** On a recognised expression that has a keyword page and no note: "N passages, no note". */
  noNote: (passages: number) => string;
}

/** The wording of the marks in the language of the locale, from the shipped catalogue. */
export function markLabels(locale: string): MarkLabels {
  const catalogue = loadCatalogue(locale);
  return {
    note: (title) => formatMessage(catalogue, "entity.markNote", { title }),
    noNote: (passages) => formatMessage(catalogue, "entity.markNoNote", { count: passages }),
  };
}
