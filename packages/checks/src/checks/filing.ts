import type { Finding } from "@concordance-wiki/core";

import type { CheckEntity, CheckInput } from "../model.js";

const CONTAINER_GROUP = "container";
const UNCLASSIFIED_DOMAIN = "unclassified";

/** Applications and domains are what entities are filed into; they are not filed themselves. */
function filedEntities(input: CheckInput): CheckEntity[] {
  return input.entities.filter(
    (entity) => input.profile.types[entity.type]?.group !== CONTAINER_GROUP,
  );
}

function finding(
  check: string,
  severity: Finding["severity"],
  entity: CheckEntity,
  message: string,
  remediation: string,
): Finding {
  return {
    check,
    severity,
    message,
    remediation,
    source: entity.source.name,
    path: entity.source.path,
    entity: entity.id,
  };
}

export function applicationMissing(input: CheckInput): Finding[] {
  return filedEntities(input)
    .filter((entity) => entity.attributes["application"] === undefined)
    .map((entity) =>
      finding(
        "W-APP-MISSING",
        "warning",
        entity,
        `${entity.id} resolves to no application`,
        "Set application on the source, in a typing rule, or in the note's frontmatter.",
      ),
    );
}

export function domainUnclassified(input: CheckInput): Finding[] {
  return filedEntities(input)
    .filter((entity) => {
      const domain = entity.attributes["domain"];
      return domain === undefined || domain === UNCLASSIFIED_DOMAIN;
    })
    .map((entity) =>
      finding(
        "W-DOMAIN-UNCLASSIFIED",
        "info",
        entity,
        `${entity.id} matches no declared domain`,
        "Add a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
      ),
    );
}
