import type { CheckRegistry, StepFinding } from "@concordance-wiki/checks";
import type { CheckOverrides, Entity, Finding, Link } from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import type { Profile } from "@concordance-wiki/profile";

export interface ModelChecksInput {
  registry: CheckRegistry;
  entities: readonly Entity[];
  links: readonly Link[];
  sources: readonly IngestedSource[];
  profile: Profile;
  /** The `checks:` block of the configuration. */
  overrides?: CheckOverrides;
}

/** Runs every enabled model check of the registry on the structural view of the model; sorted. */
export function runModelChecks(input: ModelChecksInput): Finding[] {
  return input.registry.run(
    {
      entities: input.entities.map((entity) => ({
        id: entity.id,
        type: entity.type,
        source: { name: entity.source.name, path: entity.source.path },
        attributes: entity.attributes,
      })),
      links: input.links.map((link) => ({
        from: link.from,
        to: link.to,
        relation: link.relation,
        provenance: link.provenance.map((provenance) => ({
          method: provenance.method,
          ...(provenance.path === undefined ? {} : { path: provenance.path }),
          ...(provenance.line === undefined ? {} : { line: provenance.line }),
        })),
      })),
      sources: input.sources.map((source) => ({
        name: source.name,
        files: source.files.map((file) => file.path),
      })),
      profile: input.profile,
    },
    input.overrides,
  );
}

/** Applies the same overrides to what the steps reported and completes their remediation; sorted. */
export function enrichStepFindings(
  registry: CheckRegistry,
  findings: readonly StepFinding[],
  overrides?: CheckOverrides,
): Finding[] {
  return registry.enrich(findings, overrides);
}
