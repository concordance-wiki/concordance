import type { Severity } from "@concordance-wiki/core";

import { apiConsumerMismatch, apiWithoutConsumer } from "./checks/api-consumers.js";
import type { CheckDefinition, CheckFamily, CheckId } from "./definition.js";
import type { Check } from "./model.js";

/** A check whose findings come from a pipeline step: the registry enriches them, it never computes them. */
function step(
  id: CheckId,
  severity: Severity,
  family: CheckFamily,
  description: string,
  remediation: string,
): CheckDefinition {
  return { id, severity, family, kind: "step", description, remediation, run: () => [] };
}

function model(
  id: CheckId,
  severity: Severity,
  family: CheckFamily,
  description: string,
  remediation: string,
  run: Check,
): CheckDefinition {
  return { id, severity, family, kind: "model", description, remediation, run };
}

/** One definition per page under `docs/checks`, in the order of the specification table. */
export const catalogue: readonly CheckDefinition[] = [
  step(
    "W-SOURCE-UNREACHABLE",
    "warning",
    "sources",
    "A declared source could not be fetched or read, so the build went on without it.",
    "Fix the URL, the ref or the path, or give the pipeline read access through git; raise the severity to error when a missing source must fail the build.",
  ),
  step(
    "E-LINK-BROKEN",
    "error",
    "links",
    "A markdown link points to a file that does not exist in the source.",
    "Fix the path; the linter rewrites the link under --fix when exactly one file matches the old name.",
  ),
  step(
    "W-LINK-CROSS-SOURCE",
    "warning",
    "links",
    "A markdown link points at a note of another source while cross-source links are disabled.",
    "Set inference.cross_source_links to true in concordance.yaml, or link to a note of the same source.",
  ),
  step(
    "W-REF-UNRESOLVED",
    "warning",
    "links",
    "A frontmatter reference matches no note by identifier, path or title, or several notes by title.",
    "Write the identifier, the path relative to the source root or the exact title of an existing note, or remove the reference.",
  ),
  step(
    "W-TYPE-UNKNOWN",
    "warning",
    "identifiers-and-types",
    "The resolved type is not declared in the profile; the note is treated as a document.",
    "Declare the type in the project profile, or fix the rule or frontmatter that names it.",
  ),
  step(
    "W-ATTRIBUTE-UNKNOWN",
    "warning",
    "identifiers-and-types",
    "A frontmatter attribute is not part of the type's schema; it is kept as written.",
    "Rename the attribute to one the type declares, or extend the type in the project profile.",
  ),
  step(
    "E-ID-DUP",
    "error",
    "identifiers-and-types",
    "Two entities resolve to the same identifier.",
    "Rename one of the files, or give one of them a distinct id in frontmatter.",
  ),
  step(
    "E-ID-INVALID",
    "error",
    "identifiers-and-types",
    "A frontmatter id does not follow the identifier pattern; the file path gives the identifier instead.",
    "Write the id in lowercase with hyphens and at least one slash, or remove the key to let the file path give the identifier.",
  ),
  step(
    "E-TYPE-CONFLICT",
    "error",
    "identifiers-and-types",
    "The frontmatter type contradicts the type given by the file suffix.",
    "Align the frontmatter with the suffix, or drop the frontmatter type and let the convention decide.",
  ),
  step(
    "E-FM-INVALID",
    "error",
    "identifiers-and-types",
    "The YAML frontmatter cannot be parsed.",
    "Fix the YAML; quote values that contain a colon or a hash.",
  ),
  step(
    "E-META-REL",
    "error",
    "identifiers-and-types",
    "A declared relation is not allowed between these two types by the profile.",
    "Point the reference at an entity of an allowed type, or extend the profile's allowed pairs for that relation.",
  ),
  step(
    "E-ENCODING",
    "error",
    "identifiers-and-types",
    "A file is not valid UTF-8 and is skipped.",
    "Convert the file to UTF-8 and enforce the charset through .editorconfig.",
  ),
  step(
    "W-CONV-FAILED",
    "warning",
    "documents",
    "An office document could not be converted to PDF.",
    "Check that the file opens, reduce its size, raise conversion.timeout_s and conversion.max_size_mb, or install the converter in the build image.",
  ),
  step(
    "W-CONV-SUSPECT",
    "warning",
    "documents",
    "A converted PDF contains no extractable text although the document is large.",
    "Re-export the document with selectable text, or add a markdown twin that carries its content.",
  ),
  step(
    "W-DOC-NOMD",
    "info",
    "documents",
    "A document has no markdown representation.",
    "Write a markdown note next to the document, with the same base name or a frontmatter source pointing at it.",
  ),
  step(
    "W-DUP-CANDIDATE",
    "info",
    "documents",
    "Two resources look like representations of the same document, but not enough to merge them.",
    "Declare the twin in the markdown frontmatter under source, or record the pair as merged or separated in the lock file.",
  ),
  step(
    "W-TERM-UNDEFINED",
    "warning",
    "vocabulary-and-filing",
    "A recurring expression is used across files without any note defining it.",
    "Create a term note in the glossary, or add the expression to rejected_terms in the lock file.",
  ),
  step(
    "I-TERM-HOMONYM",
    "info",
    "vocabulary-and-filing",
    "Two entities share the same normalised title or alias; occurrences link to each at half confidence.",
    "Rename one of them, add a distinguishing alias, or accept the shared form and its halved confidence.",
  ),
  step(
    "W-TERM-UNUSED",
    "info",
    "vocabulary-and-filing",
    "A glossary term is never cited anywhere.",
    "Add the spellings people use as aliases, or mark the term obsolete.",
  ),
  step(
    "W-DOMAIN-UNCLASSIFIED",
    "info",
    "vocabulary-and-filing",
    "A note matches no declared domain.",
    "Add a folder or a glob to the domain in concordance.yaml, or set domain in the note's frontmatter.",
  ),
  step(
    "W-DOMAIN-UNKNOWN",
    "warning",
    "vocabulary-and-filing",
    "A frontmatter domain is not declared in the configuration; it is kept as written.",
    "Declare the domain under domains in concordance.yaml, or name a declared domain by its id or its id path.",
  ),
  step(
    "W-APP-MISSING",
    "warning",
    "vocabulary-and-filing",
    "An entity resolves to no application.",
    "Set application on the source, in a typing rule, or in the note's frontmatter.",
  ),
  step(
    "W-APP-UNKNOWN",
    "warning",
    "vocabulary-and-filing",
    "The resolved application is not declared in the configuration; it is kept as written.",
    "Declare the application under applications in concordance.yaml, or fix the source, the rule or the frontmatter that sets it.",
  ),
  step(
    "W-STALE",
    "warning",
    "vocabulary-and-filing",
    "A source or a note has not changed for longer than the configured threshold.",
    "Review the content, mark obsolete notes as such, or raise staleness.warn_after_days for sources that legitimately change rarely.",
  ),
  step(
    "I-REL-AMBIGUOUS",
    "info",
    "vocabulary-and-filing",
    "A link between two entities fell back to the generic related relation.",
    "Move the mention under a mapped section, or declare the reference in frontmatter.",
  ),
  step(
    "I-PII-DETECTED",
    "info",
    "vocabulary-and-filing",
    "A personal name was detected in a transcript outside the pseudonymisation dictionary.",
    "Add the name to pseudonyms.yaml, or edit the transcript in its source repository.",
  ),
  step(
    "W-PRIVACY-DICTIONARY",
    "warning",
    "sources",
    "The pseudonymisation dictionary could not be read or does not match its schema; an error, and the build fails, when pseudonymisation is enabled.",
    "Fix the path of privacy.pseudonymize.dictionary, or the file it names, one entry per real name with a pseudonym.",
  ),
  step(
    "W-PRIVACY-WITHHELD",
    "warning",
    "documents",
    "A transcript was kept out of the site because its reader cannot rewrite it with the pseudonyms; the raw file is never published.",
    "Use a reader that implements rewrite for the format, or publish the transcript through a format the built-in reader handles.",
  ),
  step(
    "W-CONTRACT-UNREACHABLE",
    "warning",
    "contracts",
    "The contract an API note declares could not be fetched, read or parsed, so the note keeps its manual operations.",
    "Fix the contract URL or path, give the build network access, or check that the file is an OpenAPI 3.x or WSDL document.",
  ),
  step(
    "W-OPERATION-AMBIGUOUS",
    "warning",
    "contracts",
    "Two operation notes claim the same imported operation, or one note matches several operations of its API; nothing is attached.",
    "Give each operation note the operation_id of exactly one operation of its API, name the API in the api attribute when the source declares several contracts, or remove the note that duplicates another.",
  ),
  step(
    "W-OPERATION-UNMATCHED",
    "warning",
    "contracts",
    "An operation note names an API whose contract was imported and matches none of its operations: the operation left the contract, or the note is ahead of it.",
    "Compare the note with the contract: when the operation is gone, retire the note or point it at the operation that replaced it; when the note is ahead of the contract, keep it and give it the operation_id the next version will declare, so that it attaches then.",
  ),
  model(
    "W-API-NOCONSUMER",
    "warning",
    "contracts",
    "An API has no consumer, declared or inferred.",
    "Declare the consumers, or mention the API in the notes that use it.",
    apiWithoutConsumer,
  ),
  model(
    "W-API-CONSUMER-MISMATCH",
    "warning",
    "contracts",
    "An API declares a consumer that never cites it, or a note cites an API that does not list it.",
    "Reconcile the two notes: remove the stale consumer or add the missing mention.",
    apiConsumerMismatch,
  ),
  step(
    "W-PLUGIN-DISABLED",
    "warning",
    "plugins",
    "A declared plugin needs a system tool that is not installed, so it was not registered.",
    "Install the tool so that its command is on the PATH, or remove the plugin from the configuration.",
  ),
];
