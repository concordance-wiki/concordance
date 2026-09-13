import type { Finding } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

import type { ResolvedApplication } from "./application.js";
import { UNCLASSIFIED_DOMAIN, type ResolvedDomain } from "./domains.js";

/** Applications and domains are what entities are filed into; they are not filed themselves. */
const CONTAINER_GROUP = "container";

export interface FilingInput {
  id: string;
  type: string;
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  profile: Profile;
  application: ResolvedApplication;
  domain: ResolvedDomain;
}

function finding(
  input: FilingInput,
  check: string,
  severity: Finding["severity"],
  message: string,
  remediation: string,
): Finding {
  return {
    check,
    severity,
    source: input.source,
    path: input.path,
    entity: input.id,
    message,
    remediation,
  };
}

function applicationFindings(input: FilingInput, filed: boolean): Finding[] {
  const { application } = input;
  if (application.application === undefined) {
    if (!filed) return [];
    return [
      finding(
        input,
        "W-APP-MISSING",
        "warning",
        `${input.id} resolves to no application`,
        "Set application on the source, in a typing rule, or in the note's frontmatter.",
      ),
    ];
  }
  if (application.declared) return [];
  return [
    finding(
      input,
      "W-APP-UNKNOWN",
      "warning",
      `application "${application.application}" of ${input.id} (from ${application.origin}) is not declared in the configuration; it is kept as written`,
      "Declare the application under applications in concordance.yaml, or fix the source, the rule or the frontmatter that sets it.",
    ),
  ];
}

function domainFindings(input: FilingInput, filed: boolean): Finding[] {
  const { domain } = input;
  if (!domain.declared) {
    return [
      finding(
        input,
        "W-DOMAIN-UNKNOWN",
        "warning",
        `frontmatter domain "${domain.domain}" of ${input.id} is not declared in the configuration; it is kept as written`,
        "Declare the domain under domains in concordance.yaml, or name a declared domain by its id or its id path.",
      ),
    ];
  }
  if (domain.domain !== UNCLASSIFIED_DOMAIN || !filed) return [];
  return [
    finding(
      input,
      "W-DOMAIN-UNCLASSIFIED",
      "info",
      `${input.id} matches no declared domain`,
      "Add a folder or a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
    ),
  ];
}

/** The filing findings of one entity; containers are exempt from the missing-application and unclassified ones. */
export function filingFindings(input: FilingInput): Finding[] {
  const filed = input.profile.types[input.type]?.group !== CONTAINER_GROUP;
  return [...applicationFindings(input, filed), ...domainFindings(input, filed)];
}
