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

import { buildEntity } from "./entity.js";

export {
  FALLBACK_TYPE,
  resolveType,
  ruleMatches,
  type ResolvedType,
  type ResolveTypeInput,
} from "./cascade.js";
export { buildEntity, typeSuffixesOf, type BuildEntityInput, type BuiltEntity } from "./entity.js";

export interface TypeSourcesInput {
  sources: IngestedSource[];
  /** Parsed markdown files keyed by `<source name>/<path>`; a file without a document is skipped. */
  documents: ReadonlyMap<string, ParsedMarkdown>;
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

/** Builds one entity per parsed markdown file, resolves duplicate identifiers and sorts everything canonically. */
export function typeSources(input: TypeSourcesInput): TypedSources {
  const { sources, documents, config, profile } = input;
  const candidates: Candidate[] = [];
  const findings: Finding[] = [];
  for (const source of sources) {
    const sourceConfig = configOf(config, source.name);
    for (const file of source.files) {
      const document = documents.get(`${source.name}/${file.path}`);
      if (!file.path.endsWith(".md") || document === undefined) continue;
      const built = buildEntity({ file, source, sourceConfig, document, profile });
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
