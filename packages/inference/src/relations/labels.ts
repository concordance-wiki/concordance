import type { Locale } from "@concordance-wiki/core";
import type { Label, Profile } from "@concordance-wiki/profile";

export interface RelationLabelOptions {
  /** Read the relation from its target, the way a screen names the application it is part of. */
  inverse?: boolean;
}

/** The label of `locale`, else of its language (`fr` for `fr-CA`), else the English one. */
function localised(label: Label, locale: Locale): string {
  // The spread gives the label an anonymous type that a locale string can index.
  const byLocale: Partial<Record<string, string>> = { ...label };
  return byLocale[locale] ?? byLocale[locale.replace(/-[^]*/, "")] ?? label.en;
}

/**
 * The label the profile gives a relation, read from the source by default and from the target with
 * `inverse`: the `inverse_label` of the relation, or its plain label when it has none, as an
 * undirected one. A relation the profile does not declare reads as its slug: the site never
 * invents a label.
 */
export function relationLabel(
  profile: Profile,
  relation: string,
  locale: Locale,
  options: RelationLabelOptions = {},
): string {
  const definition = profile.relations[relation];
  if (definition === undefined) return relation;
  const label =
    options.inverse === true && definition.inverse_label !== undefined
      ? definition.inverse_label
      : definition.label;
  return localised(label, locale);
}
