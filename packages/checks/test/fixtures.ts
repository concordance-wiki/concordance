import { loadDefaultProfile } from "@concordance-wiki/profile";

import type { CheckEntity, CheckInput, CheckLink, CheckSource } from "../src/model.js";

const profile = loadDefaultProfile();

export function entity(
  id: string,
  type: string,
  attributes: Record<string, unknown> = {},
): CheckEntity {
  const [name = "", ...rest] = id.split("/");
  return { id, type, source: { name, path: `${rest.join("/")}.md` }, attributes };
}

/** Every entity filed under an application and a domain, so that only the tested check fires. */
export function filed(
  id: string,
  type: string,
  attributes: Record<string, unknown> = {},
): CheckEntity {
  return entity(id, type, {
    application: "apps/concordance-cli",
    domain: "inference",
    ...attributes,
  });
}

export function link(from: string, to: string, relation: string): CheckLink {
  return { from, to, relation };
}

export function input(
  parts: { entities?: CheckEntity[]; links?: CheckLink[]; sources?: CheckSource[] } = {},
): CheckInput {
  return {
    entities: parts.entities ?? [],
    links: parts.links ?? [],
    sources: parts.sources ?? [],
    profile,
  };
}
