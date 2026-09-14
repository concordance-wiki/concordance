import type { Entity, EntityRepresentation } from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import type { GroupedFile, GroupedFiles } from "../slots.js";
import { REPOSITORY_URL } from "../theme/default/footer.js";
import { message, type SiteContext } from "./context.js";
import { kindOf } from "./kinds.js";

/** Where a reader learns how to separate two files the build grouped, when the project gives no contribution address. */
export const LOCK_GUIDE_URL = `${REPOSITORY_URL}/blob/main/docs/guides/configuration.md#lock`;

/** The criteria the reconciliation records on a merged entity, each with the message that words it. */
const CRITERIA = [
  ["declared in frontmatter", "entity.groupedBy.declared"],
  ["same base name", "entity.groupedBy.sameName"],
  ["similar base names", "entity.groupedBy.similarName"],
  ["title equal to the heading", "entity.groupedBy.sameTitle"],
  ["similar content", "entity.groupedBy.similarContent"],
  ["lock file", "entity.groupedBy.lock"],
] as const;

/** The rungs the contract import records when a note absorbs an operation: they explain the contract, which the line counts among no file. */
const RUNGS = new Set(["operation_id", "method_path", "title"]);

/** The representations of an entity that are files of its source: a contract operation is not one. */
export function groupedFilesOf(entity: Entity): EntityRepresentation[] {
  return (entity.representations ?? []).filter(
    (representation) => representation.kind === undefined,
  );
}

/**
 * What grouped the files, worded: every criterion the model recorded, in its order, through the
 * message table, a criterion the page has no words for kept as recorded; none when the model
 * recorded nothing about the files.
 */
export function criterionOf(context: SiteContext, entity: Entity): string | undefined {
  const recorded = (entity.grouped_by ?? "")
    .split(",")
    .map((criterion) => criterion.trim())
    .filter((criterion) => criterion !== "" && !RUNGS.has(criterion));
  if (recorded.length === 0) return undefined;
  return recorded
    .map((criterion) => {
      const known = CRITERIA.find(([name]) => name === criterion);
      return known === undefined ? criterion : message(context, known[1]);
    })
    .join(", ");
}

function groupedFile(context: SiteContext, representation: EntityRepresentation): GroupedFile {
  return {
    name: representation.path.slice(representation.path.lastIndexOf("/") + 1),
    format: kindOf(context, representation.format),
  };
}

/**
 * The files the build merged into the page and why, for the properties panel of every
 * template: the line counting them with the criterion, each file with its kind, the way to
 * contest the grouping, leading to the contribution address of the project when it declares
 * one, else to the guide of the lock file; none for a page of one file.
 */
export function groupingOf(context: SiteContext, entity: Entity): GroupedFiles | undefined {
  const files = groupedFilesOf(entity);
  if (files.length < 2) return undefined;
  const count = files.length;
  const criterion = criterionOf(context, entity);
  return {
    count,
    label:
      criterion === undefined
        ? formatMessage(context.catalogue, "entity.groupedFilesCount", { count })
        : formatMessage(context.catalogue, "entity.groupedFiles", { count, criterion }),
    files: files.map((representation) => groupedFile(context, representation)),
    separate: {
      label: message(context, "entity.separateFiles"),
      href: context.contributeUrl ?? LOCK_GUIDE_URL,
    },
  };
}
