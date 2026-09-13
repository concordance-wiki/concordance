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

/**
 * A declared consumer as the identifier it names: written in full, or relative to the source of
 * the API note; a value that names no entity is kept as written and reported as stale.
 */
function resolveConsumer(value: string, api: CheckEntity, input: CheckInput): string {
  const relative = `${api.source.name}/${value}`;
  const known = new Set(input.entities.map((entity) => entity.id));
  return !known.has(value) && known.has(relative) ? relative : value;
}

/** Whether any `serves` link leaves the entity: a consumer the model knows, declared or cited. */
function serves(entity: CheckEntity, input: CheckInput): boolean {
  return input.links.some((link) => link.from === entity.id && link.relation === SERVES);
}

/**
 * Whether a `serves` link was written in the note of the consumer: at least one provenance read
 * in another file than the API note, so that the API's own `consumers` attribute and
 * `## Consumers` section do not count as citations of itself.
 */
function cites(link: CheckLink, api: CheckEntity): boolean {
  return (
    link.provenance === undefined ||
    link.provenance.some(
      (provenance) => provenance.path !== undefined && provenance.path !== api.source.path,
    )
  );
}

/** Targets of the `serves` links that another note wrote, the consumers that cite the API. */
function citingConsumers(entity: CheckEntity, input: CheckInput): string[] {
  return input.links
    .filter((link) => link.from === entity.id && link.relation === SERVES && cites(link, entity))
    .map((link) => link.to);
}

/** Whether the API note lists the consumer under its `## Consumers` section: a declaration, like the attribute. */
function declares(link: CheckLink, api: CheckEntity): boolean {
  return (link.provenance ?? []).some(
    (provenance) => provenance.method === "section_mention" && provenance.path === api.source.path,
  );
}

/** Targets of the `serves` links the API's own mapped section produced. */
function sectionConsumers(entity: CheckEntity, input: CheckInput): string[] {
  return input.links
    .filter((link) => link.from === entity.id && link.relation === SERVES && declares(link, entity))
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
  return apis(input)
    .filter((api) => !serves(api, input) && (declaredConsumers(api) ?? []).length === 0)
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
  return apis(input).flatMap((api) => {
    const written = declaredConsumers(api);
    if (written === undefined) {
      return [];
    }
    // The attribute asks for the reconciliation; the section adds to what the note declares.
    const declared = [
      ...new Set([
        ...written.map((value) => resolveConsumer(value, api, input)),
        ...sectionConsumers(api, input),
      ]),
    ];
    const served = citingConsumers(api, input);
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
