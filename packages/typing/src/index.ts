import {
  compareEntities,
  compareFindings,
  resolveDuplicates,
  type Config,
  type Entity,
  type Finding,
  type SourceConfig,
} from "@concordance-wiki/core";
import type { IngestedSource, ParsedMarkdown } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

import { compileDomains } from "./domains.js";
import { buildEntity } from "./entity.js";
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

/**
 * Builds one entity per parsed markdown file and per known resource, files it under its
 * application and domain, resolves duplicate identifiers and sorts everything canonically.
 */
export function typeSources(input: TypeSourcesInput): TypedSources {
  const { sources, documents, config, profile } = input;
  const applications = config.applications ?? [];
  const domains = compileDomains(config.domains ?? []);
  const candidates: Candidate[] = [];
  const findings: Finding[] = [];
  for (const source of sources) {
    const sourceConfig = configOf(config, source.name);
    for (const file of source.files) {
      const key = `${source.name}/${file.path}`;
      const document = documents.get(key);
      const resource = input.resources?.get(key);
      const built = file.path.endsWith(".md")
        ? document === undefined
          ? undefined
          : buildEntity({ file, source, sourceConfig, document, profile, applications, domains })
        : resource === undefined
          ? undefined
          : buildResourceEntity({
              file,
              source,
              sourceConfig,
              resource,
              profile,
              applications,
              domains,
            });
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
