import type { CanonicalModel, Entity } from "@concordance-wiki/core";
import { comparisonForm, languagePack } from "@concordance-wiki/nlp";

/** The type whose notes define the vocabulary: when several entities answer to one expression, a term wins. */
const TERM_TYPE = "term";

export type Resolution = { entity: Entity } | { candidates: Entity[] };

/** The forms an entity answers to once case, accents and inflections are set aside: its title and its aliases. */
function formsOf(entity: Entity): string[] {
  const pack = languagePack(entity.locale);
  return [entity.title, ...entity.aliases].map((form) => comparisonForm(form, pack));
}

/** One entity when the step names one, the term when the step names one term among others, else the candidates. */
function decide(matches: Entity[]): Resolution | undefined {
  if (matches.length === 0) return undefined;
  const [only] = matches;
  if (matches.length === 1 && only !== undefined) return { entity: only };
  const terms = matches.filter((entity) => entity.type === TERM_TYPE && entity.keyword !== true);
  const [term] = terms;
  return terms.length === 1 && term !== undefined ? { entity: term } : { candidates: matches };
}

/**
 * The entity an expression names, the way the recognition would read it: the identifier as
 * written, then a title or alias as written, then the same compared without case, accents
 * and inflections, then a prefix of those forms. Each step answers before the next is tried;
 * several entities at one step are candidates, unless one of them is a term, which wins.
 */
export function resolveExpression(model: CanonicalModel, expression: string): Resolution {
  const exact = model.entities.find((entity) => entity.id === expression);
  if (exact !== undefined) return { entity: exact };
  const written = decide(
    model.entities.filter(
      (entity) => entity.title === expression || entity.aliases.includes(expression),
    ),
  );
  if (written !== undefined) return written;
  const wanted = comparisonForm(expression, languagePack("en"));
  const entries = model.entities.map((entity) => ({ entity, forms: formsOf(entity) }));
  const normalised = decide(
    entries.filter((entry) => entry.forms.includes(wanted)).map((entry) => entry.entity),
  );
  if (normalised !== undefined) return normalised;
  return (
    decide(
      entries
        .filter((entry) => entry.forms.some((form) => form.startsWith(wanted)))
        .map((entry) => entry.entity),
    ) ?? { candidates: [] }
  );
}
