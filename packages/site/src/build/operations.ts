import { CONTRACT_METHOD, CONTRACT_RELATION, type Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import { OPERATION_TYPE } from "../slots.js";
import { fileKey, type SiteContext } from "./context.js";

/** The check that reports an operation note the contract of its API does not declare: the only finding the API page reads. */
export const OPERATION_UNMATCHED = "W-OPERATION-UNMATCHED";

/** An operation the contract import attached to an API: the endpoint at the other end of an `exposes` link. */
export interface ExposedOperation {
  entity: Entity;
  /** The operation name as the contract writes it. */
  name: string;
  /** Whether a hand-written note describes the operation: the import alone leaves its origin on the entity. */
  documented: boolean;
}

/**
 * The rank of every operation name in the contract of the API, from the record the import left;
 * an operation the record does not name, or a record an earlier version wrote without the
 * names, ranks after the named ones.
 */
function contractRanks(context: SiteContext, api: Entity): ReadonlyMap<string, number> {
  const record = context.model.build.contracts?.find((candidate) => candidate.api === api.id);
  return new Map((record?.operations ?? []).map((name, index) => [name, index]));
}

/**
 * The operations the contract import attached to an API, in the order of the contract: the
 * `exposes` links from it with a `contract_import` provenance, ranked by the operation names the
 * record keeps, the model order deciding between operations the record does not name.
 */
export function exposedOperations(context: SiteContext, api: Entity): ExposedOperation[] {
  const operations: ExposedOperation[] = [];
  for (const link of context.touching.get(api.id) ?? []) {
    if (link.from !== api.id || link.relation !== CONTRACT_RELATION) continue;
    const imported = link.provenance.find((provenance) => provenance.method === CONTRACT_METHOD);
    const entity = context.entities.get(link.to);
    if (imported === undefined || entity === undefined) continue;
    operations.push({
      entity,
      name: imported.operation ?? entity.title,
      documented: entity.type_origin !== "contract",
    });
  }
  const ranks = contractRanks(context, api);
  const rankOf = (operation: ExposedOperation): number =>
    ranks.get(operation.name) ?? Number.MAX_SAFE_INTEGER;
  // A stable sort: two operations the contract does not rank keep the model order.
  return operations.toSorted((a, b) => rankOf(a) - rankOf(b));
}

/** The names of the attributes of the operation type that reference an API, `api` in the default profile. */
function apiAttributes(context: SiteContext): string[] {
  const attributes = context.profile.types[OPERATION_TYPE]?.attributes ?? {};
  return Object.keys(attributes).filter((name) => {
    const definition = attributes[name];
    if (definition?.type !== "ref" && definition?.type !== "ref[]") return false;
    const { target } = definition;
    return (typeof target === "string" ? [target] : (target ?? [])).includes("api");
  });
}

/**
 * Whether a value written in the frontmatter of a note names the API: its identifier, its
 * identifier within the source of the note, the path of its note in that source, or its title.
 */
function namesApi(context: SiteContext, note: Entity, api: Entity, value: unknown): boolean {
  if (typeof value !== "string") return false;
  const written = value.trim();
  const { name } = note.source;
  return (
    written === api.id ||
    `${name}/${written}` === api.id ||
    context.byFile.get(fileKey(name, written)) === api ||
    written === api.title.trim()
  );
}

/** Whether a note names the API, through a reference attribute of the profile or a recorded link at either end. */
function declaresApi(context: SiteContext, note: Entity, api: Entity): boolean {
  const declared = apiAttributes(context).some((attribute) => {
    const value: unknown = note.attributes[attribute];
    return (Array.isArray(value) ? value : [value]).some((item: unknown) =>
      namesApi(context, note, api, item),
    );
  });
  return (
    declared ||
    (context.touching.get(note.id) ?? []).some((link) => link.from === api.id || link.to === api.id)
  );
}

/**
 * The operation notes the contract of the API does not declare, in identifier order: the notes
 * of the operation type that a `W-OPERATION-UNMATCHED` finding names and that name the API,
 * either in their frontmatter or through a link. Described, absent from the contract.
 */
export function unmatchedOperations(context: SiteContext, api: Entity): Entity[] {
  const named = new Set<string>();
  for (const finding of context.model.findings) {
    if (finding.check === OPERATION_UNMATCHED && finding.entity !== undefined) {
      named.add(finding.entity);
    }
  }
  return [...named]
    .sort(byCodeUnit)
    .map((id) => context.entities.get(id))
    .filter(
      (note): note is Entity =>
        note?.type === OPERATION_TYPE &&
        note.type_origin !== "contract" &&
        declaresApi(context, note, api),
    );
}

/** A string attribute of an operation, its `method` or `path`, as the contract or the note wrote it. */
export function operationAttribute(entity: Entity, key: "method" | "path"): string | undefined {
  const value = entity.attributes[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
