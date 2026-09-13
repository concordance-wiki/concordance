export { combineConfidences, glossaryConfidence } from "./combine/confidence.js";
export type { GlossaryCombination } from "./combine/confidence.js";
export { combineLinks, combineOptions } from "./combine/links.js";
export type { CombineOptions } from "./combine/links.js";
export { MAX_DISPLAYED_NEIGHBOURS, displayedNeighbourhood } from "./display/neighbourhood.js";
export { displayOptions } from "./display/options.js";
export { displayedNeighbourhoodToModel } from "./display/serialize.js";
export type {
  DisplayableEntity,
  DisplayOptions,
  DisplayedNeighbour,
  DisplayedNeighbourhood,
  DisplayedNeighbourhoodInput,
  NeighbourDirection,
  NeighbourKind,
} from "./display/types.js";
export { duplicateOptions, DUPLICATE_DEFAULTS } from "./duplicates/options.js";
export {
  DUPLICATE_CHECK,
  formatDuplicateStats,
  resolveDuplicateResources,
} from "./duplicates/resolve.js";
export type {
  DuplicateGroup,
  DuplicateInput,
  DuplicateLock,
  DuplicateMode,
  DuplicateOptions,
  DuplicatePair,
  DuplicateRepresentation,
  DuplicateResource,
  DuplicateResult,
  DuplicateSignal,
  DuplicateStats,
} from "./duplicates/types.js";
export { explicitLinks, locateLink } from "./explicit/links.js";
export type { LocatedLink, SourceFiles } from "./explicit/links.js";
export type {
  ExplicitLinksInput,
  ExplicitLinksResult,
  LinkableEntity,
  SourceResource,
} from "./explicit/types.js";
export { accumulateCooccurrences } from "./neighbourhood/accumulate.js";
export { cooccurrenceLinks } from "./neighbourhood/links.js";
export { neighbourhoodOptions } from "./neighbourhood/options.js";
export { neighbourhoodToModel } from "./neighbourhood/serialize.js";
export type {
  Neighbour,
  Neighbourhood,
  NeighbourhoodOptions,
  OccurrenceLike,
} from "./neighbourhood/types.js";
export {
  frontmatterLinks,
  type FrontmatterLinksInput,
  type FrontmatterLinksResult,
} from "./frontmatter/links.js";
export {
  indexEntities,
  resolveReference,
  type EntityIndex,
  type ReferenceResolution,
  type ResolveContext,
} from "./frontmatter/resolve.js";
export {
  mentionLinks,
  type MentionLinksInput,
  type MentionLinksResult,
  type MentionOccurrence,
} from "./mentions/links.js";
export { foldHeading, mappedSection, type MappedSection } from "./mentions/sections.js";
export {
  FALLBACK_RELATION,
  RELATION_ORIGIN,
  relationLabel,
  typeRelations,
  type RelationLabelOptions,
  type TypedEntity,
  type TypeRelationsInput,
  type TypeRelationsResult,
} from "./relations/index.js";
export {
  attachOperations,
  CONTRACT_REPRESENTATION,
  importedOperations,
  MATCH_RUNGS,
  matchOperations,
  mergeOperation,
  OPERATION_AMBIGUOUS,
  OPERATION_UNMATCHED,
  operationNotes,
  redirectLinks,
  type Ambiguity,
  type AttachOperationsInput,
  type AttachOperationsResult,
  type ImportedOperation,
  type MatchResult,
  type MatchRung,
  type OperationMatch,
  type OperationNote,
} from "./operations/index.js";
