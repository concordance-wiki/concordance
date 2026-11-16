import { byCodeUnit, type Finding } from "@concordance-wiki/core";

import type { CheckEntity, CheckInput } from "../model.js";

/** From how many entities of one source a title counts as a template's rather than each one's own. */
export const SHARED_TITLE_THRESHOLD = 3;

export const SHARED_TITLE_REMEDIATION =
  "When the notes come from a template whose first heading is a section, set headings: sections on the source so that the file names title them; otherwise give each one a title in its frontmatter, or each document its own title property.";

/** How many paths the message names before it counts the rest. */
const NAMED_PATHS = 3;

/** Titles compared as a reader would: case, surrounding spaces and runs of spaces left aside. */
function titleKey(title: string): string {
  return title.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase();
}

function listed(paths: readonly string[]): string {
  const named = paths.slice(0, NAMED_PATHS).join(", ");
  const rest = paths.length - NAMED_PATHS;
  return rest > 0 ? `${named} and ${String(rest)} more` : named;
}

/**
 * One finding per title that at least three entities of one source share, on the first of their
 * files: the mark of a template whose first heading, or whose document title, every file keeps.
 * The entities stay as they are; the finding only names them.
 */
export function sharedTitles(input: CheckInput): Finding[] {
  const groups = new Map<string, { source: string; title: string; entities: CheckEntity[] }>();
  for (const entity of input.entities) {
    if (entity.title === undefined) continue;
    const key = titleKey(entity.title);
    if (key === "") continue;
    const groupKey = `${entity.source.name}\u0000${key}`;
    const group = groups.get(groupKey);
    if (group === undefined) {
      groups.set(groupKey, { source: entity.source.name, title: entity.title, entities: [entity] });
    } else {
      group.entities.push(entity);
    }
  }
  const findings: Finding[] = [];
  for (const group of groups.values()) {
    if (group.entities.length < SHARED_TITLE_THRESHOLD) continue;
    const entities = [...group.entities].sort((a, b) => byCodeUnit(a.source.path, b.source.path));
    // The group holds at least the threshold, so a first entity exists.
    const first = entities[0] as CheckEntity;
    findings.push({
      check: "W-TITLE-SHARED",
      severity: "warning",
      source: group.source,
      path: first.source.path,
      entity: first.id,
      message: `"${first.title ?? group.title}" titles ${String(entities.length)} entities of the source ${group.source}: ${listed(entities.map((entity) => entity.source.path))}`,
      remediation: SHARED_TITLE_REMEDIATION,
    });
  }
  return findings;
}
