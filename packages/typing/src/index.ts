import {
  compareEntities,
  compareFindings,
  resolveDuplicates,
  type ApplicationConfig,
  type Config,
  type Entity,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import type { IngestedFile, IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

import { compileDomains, type DomainMatcher } from "./domains.js";
import { buildEntity, type BuiltEntity } from "./entity.js";
import { buildResourceEntity, type Resource } from "./resource.js";

export {
  resolveApplication,
  type ApplicationOrigin,
  type ResolveApplicationInput,
  type ResolvedApplication,
} from "./application.js";
export {
  FALLBACK_TYPE,
  resolveType,
  ruleMatches,
  type ResolvedType,
  type ResolveTypeInput,
} from "./cascade.js";
export {
  compileDomains,
  resolveDomain,
  UNCLASSIFIED_DOMAIN,
  type CompiledDomain,
  type DomainMatcher,
  type DomainOrigin,
  type ResolvedDomain,
} from "./domains.js";
export { buildEntity, typeSuffixesOf, type BuildEntityInput, type BuiltEntity } from "./entity.js";
export { filingFindings, type FilingInput } from "./filing.js";
export {
  buildResourceEntity,
  resourceAttributes,
  type BuildResourceEntityInput,
  type BuiltResourceEntity,
  type Resource,
} from "./resource.js";

export interface TypeSourcesInput {
  sources: IngestedSource[];
  /** Parsed markdown files keyed by `<source name>/<path>`; a file without a document is skipped. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
  /** The other files a reader or a converter knows, keyed the same way; a file listed nowhere is not an entity. */
  resources?: ReadonlyMap<string, Resource>;
  config: Config;
  profile: Profile;
}

export interface TypedSources {
  entities: Entity[];
  findings: Finding[];
}

interface Candidate {
  id: string;
  source: string;
  path: string;
  entity: Entity;
}

function configOf(config: Config, name: string): SourceConfig {
  const found = config.sources.find((source) => source.name === name);
  if (found === undefined) {
    throw new Error(`ingested source "${name}" is not declared in the configuration`);
  }
  return found;
}

/** What every entity of a source is built with, whatever its kind. */
interface Filing {
  source: IngestedSource;
  sourceConfig: SourceConfig;
  profile: Profile;
  applications: readonly ApplicationConfig[];
  domains: DomainMatcher;
}

/** The entity of a file: from its parsed note, or from its resource; nothing when the file has neither. */
function buildOne(
  input: TypeSourcesInput,
  filing: Filing,
  file: IngestedFile,
): BuiltEntity | undefined {
  const key = `${filing.source.name}/${file.path}`;
  if (file.path.endsWith(".md")) {
    const document = input.documents.get(key);
    return document === undefined ? undefined : buildEntity({ ...filing, file, document });
  }
  const resource = input.resources?.get(key);
  return resource === undefined ? undefined : buildResourceEntity({ ...filing, file, resource });
}

/**
 * Builds one entity per parsed markdown file and per known resource, files it under its
 * application and domain, resolves duplicate identifiers and sorts everything canonically.
 */
export function typeSources(input: TypeSourcesInput): TypedSources {
  const { sources, config, profile } = input;
  const applications = config.applications ?? [];
  const domains = compileDomains(config.domains ?? []);
  const candidates: Candidate[] = [];
  const findings: Finding[] = [];
  for (const source of sources) {
    const filing = {
      source,
      sourceConfig: configOf(config, source.name),
      profile,
      applications,
      domains,
    };
    for (const file of source.files) {
      const built = buildOne(input, filing, file);
      if (built === undefined) continue;
      candidates.push({
        id: built.entity.id,
        source: source.name,
        path: file.path,
        entity: built.entity,
      });
      findings.push(...built.findings);
    }
  }
  const duplicates = resolveDuplicates(candidates);
  return {
    entities: duplicates.kept.map((candidate) => candidate.entity).sort(compareEntities),
    findings: [...findings, ...duplicates.findings].sort(compareFindings),
  };
}
