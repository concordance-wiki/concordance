import {
  compareFindings,
  type CheckContribution,
  type CheckOverrides,
  type Finding,
} from "@concordance-wiki/core";

import { catalogue } from "./catalogue.js";
import { isCheckId, type CheckDefinition } from "./definition.js";
import type { CheckInput } from "./model.js";

/** A registration or configuration mistake: the caller turns it into an execution error, never into a finding. */
export class CheckRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckRegistryError";
  }
}

/** A finding as a pipeline step reports it; the remediation may be left to the catalogue. */
export type StepFinding = Omit<Finding, "remediation"> & { remediation?: string };

export interface CheckRegistry {
  get: (id: string) => CheckDefinition | undefined;
  /** Every registered check, sorted by identifier. */
  list: () => CheckDefinition[];
  /** Runs every enabled check on the model and applies the severity overrides; sorted. */
  run: (input: CheckInput, overrides?: CheckOverrides) => Finding[];
  /** Applies the same overrides to findings reported by pipeline steps and completes their remediation; sorted. */
  enrich: (findings: readonly StepFinding[], overrides?: CheckOverrides) => Finding[];
}

function fromContribution(contribution: CheckContribution): CheckDefinition {
  const { id } = contribution;
  if (!isCheckId(id)) {
    throw new CheckRegistryError(
      `check ${id}: the identifier does not follow the E-, W- or I- pattern`,
    );
  }
  return {
    id,
    severity: contribution.severity,
    family: "plugins",
    kind: "model",
    description: contribution.description,
    remediation: contribution.remediation,
    run: (input) => contribution.run({ payload: input }),
  };
}

function index(definitions: readonly CheckDefinition[]): Map<string, CheckDefinition> {
  const byId = new Map<string, CheckDefinition>();
  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new CheckRegistryError(`check ${definition.id}: registered twice`);
    }
    byId.set(definition.id, definition);
  }
  return byId;
}

export function createRegistry(
  definitions: readonly CheckDefinition[] = catalogue,
  contributed: readonly CheckContribution[] = [],
): CheckRegistry {
  const byId = index([...definitions, ...contributed.map(fromContribution)]);
  // Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
  const sorted = [...byId.values()].sort((a, b) => Number(a.id > b.id) - Number(a.id < b.id));

  const definitionOf = (id: string): CheckDefinition => {
    const definition = byId.get(id);
    if (definition === undefined) {
      throw new CheckRegistryError(`check ${id}: not registered`);
    }
    return definition;
  };
  const validate = (overrides: CheckOverrides): void => {
    for (const id of Object.keys(overrides)) {
      if (!byId.has(id)) {
        throw new CheckRegistryError(`checks: ${id} is not a registered check`);
      }
    }
  };
  const enabled = (id: string, overrides: CheckOverrides): boolean =>
    overrides[id]?.enabled !== false;
  const reseveritise = (finding: Finding, overrides: CheckOverrides): Finding => {
    const severity = overrides[finding.check]?.severity;
    return severity === undefined ? finding : { ...finding, severity };
  };

  return {
    get: (id) => byId.get(id),
    list: () => [...sorted],
    run: (input, overrides = {}) => {
      validate(overrides);
      return sorted
        .filter((definition) => enabled(definition.id, overrides))
        .flatMap((definition) => definition.run(input))
        .map((finding) => reseveritise(finding, overrides))
        .sort(compareFindings);
    },
    enrich: (findings, overrides = {}) => {
      validate(overrides);
      return findings
        .filter((finding) => enabled(finding.check, overrides))
        .map((finding) => {
          const { remediation } = definitionOf(finding.check);
          return reseveritise(
            { ...finding, remediation: finding.remediation ?? remediation },
            overrides,
          );
        })
        .sort(compareFindings);
    },
  };
}
