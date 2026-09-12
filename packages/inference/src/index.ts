export { explicitLinks } from "./explicit/links.js";
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
