export { parseConfig, parseTheme, parseYaml } from "./config/load.js";
export { formatIssue, formatValidation } from "./config/report.js";
export { readSchema, type SchemaName } from "./config/schema.js";
export type * from "./config/types.js";
export { validateTheme } from "./config/theme.js";
export {
  describeSchemaError,
  isWellFormedGlob,
  schemaIssues,
  validateConfig,
} from "./config/validate.js";
export { compileGlobs, type PathMatcher } from "./glob/index.js";
export { resolveDuplicates, type Identified } from "./identity/duplicates.js";
export {
  identifierFor,
  pagePath,
  pageUrl,
  type IdentifierInput,
  type IdentifierResult,
} from "./identity/identifier.js";
export { slugify } from "./identity/slug.js";
export { epochClock, fixedClock, systemClock, type Clock } from "./io/clock.js";
export { commandExists } from "./io/command.js";
export {
  memoryFileSystem,
  nodeFileSystem,
  type FileSystem,
  type MemoryFileSystem,
} from "./io/file-system.js";
export type { FileHistory, GitClient } from "./io/git.js";
export { nodeGit } from "./io/node-git.js";
export {
  serializeBuildLog,
  shouldFail,
  summarize,
  type BuildLog,
  type BuildSummary,
  type DuplicateCounts,
  type KeywordCounts,
} from "./model/build-log.js";
export {
  compareContracts,
  type CandidateObject,
  type ContractField,
  type ContractRecord,
  type ContractSchema,
} from "./model/contract.js";
export {
  compareEntities,
  type Entity,
  type EntityGraph,
  type EntityRepresentation,
  type EntitySource,
  type TypeOrigin,
} from "./model/entity.js";
export { compareFindings, type Finding, type Severity } from "./model/finding.js";
export {
  compareLinks,
  compareProvenances,
  sortCanonically,
  type LinkOrder,
  type ProvenanceOrder,
} from "./model/order.js";
export {
  type Link,
  type Provenance,
  type ProvenanceMethod,
  type ProvenanceOccurrence,
} from "./model/link.js";
export {
  assembleModel,
  canonicalJson,
  ModelError,
  parseModel,
  quote,
  relationshipType,
  serializeModel,
  sortKeysDeep,
  toCypher,
  validateModel,
  type AssembleModelInput,
  type Candidates,
  type CanonicalModel,
  type DisplayedNeighbour,
  type DisplayedNeighbourhood,
  type DuplicateCandidate,
  type ModelBuild,
  type ModelSource,
  type Neighbour,
  type Neighbours,
  type TermCandidate,
  type TermPenalty,
  type TermSignals,
  type TermContext,
} from "./model/serialize/index.js";
export { PLUGIN_API_VERSION } from "./plugin/api.js";
export {
  loadPseudonymDictionary,
  nameKey,
  parsePseudonymDictionary,
  pseudonymDictionary,
  type PseudonymDictionary,
  type PseudonymDictionaryResult,
  type PseudonymEntry,
} from "./privacy/dictionary.js";
export {
  createSpeakerNumbering,
  detectPersonalMentions,
  pseudonymizeSpeaker,
  pseudonymizeText,
  type DetectOptions,
  type PersonalMention,
  type PseudonymizedText,
  type PseudonymizeOptions,
  type SpeakerNumbering,
  type SpeakerOptions,
} from "./privacy/pseudonymize.js";
export { transcriptsPublished } from "./privacy/publication.js";
export {
  pseudonymizeTranscript,
  transcriptSubstitution,
  type PseudonymizedTranscript,
  type TranscriptCueLike,
  type TranscriptLike,
  type TranscriptOptions,
  type TranscriptSubstitution,
} from "./privacy/transcript.js";
export { substituteStrings } from "./privacy/values.js";
export type * from "./plugin/api.js";
export {
  cachedContractPath,
  cachedContractViewPath,
  CONTRACT_METHOD,
  CONTRACT_RELATION,
  CONTRACT_UNREACHABLE,
  contractViewOf,
  declaredContracts,
  DEFAULT_CONTRACT_CONFIDENCE,
  fingerprintOf,
  loadContracts,
  readCachedContract,
  readCachedContractView,
  writeCachedContract,
  writeCachedContractView,
  xmlRootOf,
  type ContractError,
  type ContractOperation,
  type ContractParameter,
  type ContractReader,
  type ContractResponse,
  type ContractSummary,
  type ContractView,
  type DeclaredContract,
} from "./plugin/contracts.js";
export { definePlugin, PluginDefinitionError } from "./plugin/define.js";
export { importPlugin } from "./plugin/node-loader.js";
export {
  loadPlugins,
  PluginLoadError,
  typeSlugOf,
  type LoadedPlugins,
  type PluginLoaderDependencies,
  type PluginRegistration,
  type PluginRegistry,
  type RegisteredType,
} from "./plugin/registry.js";
