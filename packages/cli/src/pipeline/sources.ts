import {
  compareContracts,
  compareEntities,
  compareFindings,
  compareLinks,
  type CandidateObject,
  type ContractRecord,
  type Entity,
  type Finding,
  type Link,
  type PluginContext,
  type ProvenanceMethod,
  type SourceProvider,
} from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

export interface PluginSourcesInput {
  /** The `source` contributions of the registry, in plugin declaration order. */
  providers: readonly SourceProvider[];
  /** The entities typed from the notes; a provider reads them to find what it must fetch. */
  entities: readonly Entity[];
  /** Absolute root folder of every ingested source, by name. */
  roots: Readonly<Record<string, string>>;
  /** When every ingested file last changed, by source name then path; a provider dates what it reads next to the notes by it. */
  dates?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  cacheDirectory: string;
  profile: Profile;
  context: PluginContext;
}

export interface PluginSourcesOutput {
  entities: Entity[];
  links: Link[];
  objects: CandidateObject[];
  contracts: ContractRecord[];
  findings: Finding[];
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function compareObjects(a: CandidateObject, b: CandidateObject): number {
  return (
    byCodeUnit(a.from, b.from) || byCodeUnit(a.name, b.name) || byCodeUnit(a.contract, b.contract)
  );
}

/** The methods whose confidence is one number in the profile; the glossary scale is an object. */
const scalarMethods = [
  "explicit_link",
  "lock_promoted",
  "contract_import",
  "frontmatter_ref",
  "folder_zone",
  "section_mention",
  "cooccurrence",
  "embedding",
] as const;

/** The confidence of every method the profile declares, as the plugin API hands it to a source. */
export function methodConfidences(profile: Profile): Partial<Record<ProvenanceMethod, number>> {
  const confidences: Partial<Record<ProvenanceMethod, number>> = {};
  for (const method of scalarMethods) {
    const confidence = profile.confidence[method];
    if (confidence !== undefined) confidences[method] = confidence;
  }
  return confidences;
}

/** A copy of the dates a provider may keep: what it receives is its own. */
function fileDates(
  dates: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Record<string, Record<string, string>> {
  return Object.fromEntries(Object.entries(dates).map(([source, files]) => [source, { ...files }]));
}

/**
 * Runs every source contribution after typing, so that a plugin reads the typed entities (an
 * `api` note and its `contract` attribute) and adds what it imports: endpoint entities,
 * `exposes` links, candidate objects and one record per contract. Providers run one after the
 * other in declaration order and every list is sorted, so that the output never depends on
 * their scheduling.
 */
export async function loadPluginSources(input: PluginSourcesInput): Promise<PluginSourcesOutput> {
  const output: PluginSourcesOutput = {
    entities: [],
    links: [],
    objects: [],
    contracts: [],
    findings: [],
  };
  for (const provider of input.providers) {
    const loaded = await provider.load({
      payload: {
        entities: [...input.entities],
        roots: { ...input.roots },
        cacheDirectory: input.cacheDirectory,
        confidence: methodConfidences(input.profile),
        ...(input.dates === undefined ? {} : { dates: fileDates(input.dates) }),
      },
      context: input.context,
    });
    output.entities.push(...loaded.entities);
    output.links.push(...loaded.links);
    output.objects.push(...loaded.candidates);
    output.contracts.push(...loaded.contracts);
    output.findings.push(...loaded.findings);
  }
  output.entities.sort(compareEntities);
  output.links.sort(compareLinks);
  output.objects.sort(compareObjects);
  output.contracts.sort(compareContracts);
  output.findings.sort(compareFindings);
  return output;
}
