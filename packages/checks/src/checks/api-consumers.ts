import type { Finding } from "@concordance-wiki/core";

import type { CheckEntity, CheckInput, CheckLink } from "../model.js";

const API_TYPE = "api";
const SERVES = "serves";

/** The `consumers` attribute as written; `undefined` when the note declares none. */
function declaredConsumers(entity: CheckEntity): string[] | undefined {
  const value = entity.attributes["consumers"];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

/** What the two checks look up, built once per run: the identifiers, the entities and the `serves` links by API. */
interface Indexed {
  known: ReadonlySet<string>;
  byId: ReadonlyMap<string, CheckEntity>;
  /** The `serves` links leaving each entity, in model order. */
  serves: ReadonlyMap<string, readonly CheckLink[]>;
}

function indexOf(input: CheckInput): Indexed {
  const serves = new Map<string, CheckLink[]>();
  for (const link of input.links) {
    if (link.relation !== SERVES) continue;
    const leaving = serves.get(link.from);
    if (leaving === undefined) serves.set(link.from, [link]);
    else leaving.push(link);
  }
  return {
    known: new Set(input.entities.map((entity) => entity.id)),
    byId: new Map(input.entities.map((entity) => [entity.id, entity])),
    serves,
  };
}

/**
 * A declared consumer as the identifier it names: written in full, or relative to the source of
 * the API note; a value that names no entity is kept as written and reported as stale.
 */
function resolveConsumer(value: string, api: CheckEntity, index: Indexed): string {
  const relative = `${api.source.name}/${value}`;
  return !index.known.has(value) && index.known.has(relative) ? relative : value;
}

/** Whether any `serves` link leaves the entity: a consumer the model knows, declared or cited. */
function serves(entity: CheckEntity, index: Indexed): boolean {
  return (index.serves.get(entity.id) ?? []).length > 0;
}

/**
 * Whether a `serves` link was written in the note of the consumer: at least one provenance read
 * in the consumer's own note, so that the API's own `consumers` attribute and `## Consumers`
 * section, or a link read in a third note, do not count as citations by the consumer.
 */
function cites(link: CheckLink, consumer: CheckEntity | undefined): boolean {
  if (link.provenance === undefined) return true;
  // A provenance in a third note is that note's word, not the consumer's.
  return (
    consumer !== undefined &&
    link.provenance.some((provenance) => provenance.path === consumer.source.path)
  );
}

/** Targets of the `serves` links the consumer's own note wrote, the consumers that cite the API. */
function citingConsumers(entity: CheckEntity, index: Indexed): string[] {
  return (index.serves.get(entity.id) ?? [])
    .filter((link) => cites(link, index.byId.get(link.to)))
    .map((link) => link.to);
}

/** Whether the API note lists the consumer under its `## Consumers` section: a declaration, like the attribute. */
function declares(link: CheckLink, api: CheckEntity): boolean {
  return (link.provenance ?? []).some(
    (provenance) => provenance.method === "section_mention" && provenance.path === api.source.path,
  );
}

/** Targets of the `serves` links the API's own mapped section produced. */
function sectionConsumers(entity: CheckEntity, index: Indexed): string[] {
  return (index.serves.get(entity.id) ?? [])
    .filter((link) => declares(link, entity))
    .map((link) => link.to);
}

function apis(input: CheckInput): CheckEntity[] {
  return input.entities.filter((entity) => entity.type === API_TYPE);
}

function finding(
  check: string,
  entity: CheckEntity,
  message: string,
  remediation: string,
): Finding {
  return {
    check,
    severity: "warning",
    message,
    remediation,
    source: entity.source.name,
    path: entity.source.path,
    entity: entity.id,
  };
}

export function apiWithoutConsumer(input: CheckInput): Finding[] {
  const index = indexOf(input);
  return apis(input)
    .filter((api) => !serves(api, index) && (declaredConsumers(api) ?? []).length === 0)
    .map((api) =>
      finding(
        "W-API-NOCONSUMER",
        api,
        `${api.id} has no consumer: no consumers attribute names one and no note cites it`,
        "Declare the consumers, or mention the API in the notes that use it.",
      ),
    );
}

export function apiConsumerMismatch(input: CheckInput): Finding[] {
  const remediation =
    "Reconcile the two notes: remove the stale consumer or add the missing mention.";
  const index = indexOf(input);
  return apis(input).flatMap((api) => {
    const written = declaredConsumers(api);
    if (written === undefined) {
      return [];
    }
    // The attribute asks for the reconciliation; the section adds to what the note declares.
    const declared = [
      ...new Set([
        ...written.map((value) => resolveConsumer(value, api, index)),
        ...sectionConsumers(api, index),
      ]),
    ];
    const served = citingConsumers(api, index);
    const stale = declared
      .filter((consumer) => !served.includes(consumer))
      .map((consumer) =>
        finding(
          "W-API-CONSUMER-MISMATCH",
          api,
          `${api.id} declares consumer ${consumer}, which never cites it`,
          remediation,
        ),
      );
    const missing = served
      .filter((consumer) => !declared.includes(consumer))
      .map((consumer) =>
        finding(
          "W-API-CONSUMER-MISMATCH",
          api,
          `${consumer} cites ${api.id}, which does not list it among its consumers`,
          remediation,
        ),
      );
    return [...stale, ...missing];
  });
}
