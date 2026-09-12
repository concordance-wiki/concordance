import type { Finding } from "@concordance-wiki/core";

import type { CheckEntity, CheckInput } from "../model.js";

const API_TYPE = "api";
const SERVES = "serves";

/** The `consumers` attribute as a list of identifiers; `undefined` when the note declares none. */
function declaredConsumers(entity: CheckEntity): string[] | undefined {
  const value = entity.attributes["consumers"];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

/** Targets of the `serves` links leaving the entity, that is, the consumers the model knows. */
function servedConsumers(entity: CheckEntity, input: CheckInput): string[] {
  return input.links
    .filter((link) => link.from === entity.id && link.relation === SERVES)
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
    .filter(
      (api) =>
        servedConsumers(api, input).length === 0 && (declaredConsumers(api) ?? []).length === 0,
    )
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
    const declared = declaredConsumers(api);
    if (declared === undefined) {
      return [];
    }
    const served = servedConsumers(api, input);
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
