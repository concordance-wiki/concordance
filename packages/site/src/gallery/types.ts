import { parseYaml, type CanonicalModel, type Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import type { Profile, TypeModule } from "@concordance-wiki/profile";

import { siteContext } from "../build/context.js";
import { entityPageOf } from "../build/entity-page.js";
import type { EntityFragment } from "../build/fragments.js";
import { renderMarkdown } from "../markdown/render.js";
import { byCodeUnit } from "../order.js";
import type { EntityPageProps } from "../slots.js";
import type { ResolvedTheme, ThemeOverride } from "../theme/types.js";

/** The registered types the gallery shows: the profile they are declared in and the modules whose templates it renders. */
export interface GalleryTypes {
  profile: Profile;
  modules: readonly TypeModule[];
}

/** One page of the gallery per registered type: its note template rendered as a note of that type. */
export interface TypePage {
  /** File name under the output folder, `type-<slug>.html`. */
  file: string;
  type: string;
  /** The label of the type in English. */
  label: string;
  props: EntityPageProps;
  /** The component that renders the page when a theme or the module provides one for the type. */
  override?: ThemeOverride;
}

/** The frontmatter keys that become fields of the entity rather than attributes, as the typing does. */
const COMMON_KEYS = new Set([
  "id",
  "type",
  "title",
  "aliases",
  "status",
  "summary",
  "tags",
  "application",
  "domain",
]);

const FIXTURE_SOURCE = "templates";
const BUILT_AT = "2024-05-01T10:00:00.000Z";

/** The frontmatter of a template as a record; a template without one, or with one that is not a mapping, has no attribute. */
function frontmatterOf(template: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(template);
  const parsed = parseYaml(match?.[1] ?? "");
  if (
    "issue" in parsed ||
    typeof parsed.document !== "object" ||
    parsed.document === null ||
    Array.isArray(parsed.document)
  ) {
    return {};
  }
  // A mapping parsed from YAML is a plain object whose values are read as unknown.
  return parsed.document as Record<string, unknown>;
}

/** The entity a template stands for: identified and typed by its module, its frontmatter as attributes. */
function entityOf(module: TypeModule, template: string, title: string | undefined): Entity {
  const frontmatter = frontmatterOf(template);
  const attributes: Record<string, unknown> = {};
  for (const key of Object.keys(frontmatter).sort(byCodeUnit)) {
    if (!COMMON_KEYS.has(key)) attributes[key] = frontmatter[key];
  }
  const { status } = frontmatter;
  return {
    id: `types/${module.slug}`,
    type: module.slug,
    title: title ?? module.slug,
    aliases: [],
    locale: "en",
    status: typeof status === "string" ? status : "valid",
    type_origin: "frontmatter",
    graph: module.declaration.graph ?? "full",
    attributes,
    source: { name: FIXTURE_SOURCE, path: `${module.slug}.md`, line: 1 },
  };
}

/**
 * The type pages of the gallery, in slug order: every module the profile declares that ships a
 * template, rendered through the view model of the entity page as a note of its type, alone in
 * a model of templates; the override names the dedicated component of the type when the theme
 * resolved one.
 */
export function typePages(types: GalleryTypes, theme: ResolvedTheme): TypePage[] {
  const shown: { entity: Entity; label: string }[] = [];
  const fragments = new Map<string, EntityFragment>();
  for (const module of [...types.modules].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    const definition = types.profile.types[module.slug];
    if (module.template === undefined || definition === undefined) continue;
    const rendered = renderMarkdown(module.template);
    const entity = entityOf(module, module.template, rendered.title);
    shown.push({ entity, label: definition.label.en });
    fragments.set(entity.id, { id: entity.id, sections: rendered.sections });
  }
  const entities = shown.map(({ entity }) => entity);
  const model: CanonicalModel = {
    version: 1,
    build: {
      tool: "gallery",
      at: BUILT_AT,
      profile_hash: "",
      sources: [{ name: FIXTURE_SOURCE, files: entities.length }],
    },
    entities,
    links: [],
    findings: [],
    candidates: { terms: [], duplicates: [] },
  };
  const context = siteContext({
    model,
    profile: types.profile,
    catalogue: loadCatalogue("en"),
    fragments,
    locale: "en",
  });
  return shown.map(({ entity, label }) => {
    const slot = `EntityPage@${entity.type}`;
    const override = theme.overrides.find((candidate) => candidate.slot === slot);
    return {
      file: `type-${entity.type}.html`,
      type: entity.type,
      label,
      props: entityPageOf(context, entity),
      ...(override === undefined ? {} : { override }),
    };
  });
}
