import type { CanonicalModel, Entity } from "@concordance-wiki/core";

/** The filters of a list, each an exact value of the entity. */
export interface ListFilters {
  type?: string;
  domain?: string;
  application?: string;
  source?: string;
  status?: string;
}

/** Above this many entities a list without a filter is refused unless `--all` says so. */
export const LIST_WITHOUT_FILTER_LIMIT = 500;

export function hasFilter(filters: ListFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

/** The entities the filters keep, in the order of the model, which is that of the identifiers. */
export function listEntities(model: CanonicalModel, filters: ListFilters): Entity[] {
  return model.entities.filter(
    (entity) =>
      (filters.type === undefined || entity.type === filters.type) &&
      (filters.domain === undefined || entity.domain === filters.domain) &&
      (filters.application === undefined || entity.application === filters.application) &&
      (filters.source === undefined || entity.source.name === filters.source) &&
      (filters.status === undefined || entity.status === filters.status),
  );
}

/** One line per entity: identifier, title, type, domain, the date of its last change when known. */
export function listLine(entity: Entity): string {
  const kind = entity.keyword === true ? "keyword page" : entity.type;
  const domain = entity.domain === undefined ? "" : ` · ${entity.domain}`;
  const changed =
    entity.source.last_modified === undefined
      ? ""
      : ` · ${entity.source.last_modified.slice(0, 10)}`;
  return `${entity.id} — ${entity.title} [${kind}${domain}]${changed}`;
}
