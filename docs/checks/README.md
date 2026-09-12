# Checks

Every finding produced by the build or the linter carries one of these identifiers. Severity prefixes: `E-` error, `W-` warning, `I-` info. Each page shows the situation before and after the fix.

Severities can be overridden under `checks:` in `concordance.yaml` or, per repository, in `concordance-lint.yaml`; see the [configuration guide](../guides/configuration.md#checks) for what `enabled` and `severity` do. The build fails according to `build.fail_on`; the linter fails according to `--fail-on`, `error` by default.

Every check listed here is registered once, with its default severity, description and remediation, in the [`@concordance-wiki/checks`](../../packages/checks/README.md) package, which the build and the linter consume identically. A plugin adds its own checks through the `checks` contribution of its manifest; they join the same registry, under a new identifier, with their own page.

## Sources

| Check | Severity | Meaning |
|---|---|---|
| [`W-SOURCE-UNREACHABLE`](W-SOURCE-UNREACHABLE.md) | warning | A declared source could not be fetched or read, so the build went on without it. |

## Links

| Check | Severity | Meaning |
|---|---|---|
| [`E-LINK-BROKEN`](E-LINK-BROKEN.md) | error | A markdown link points to a file that does not exist in the source. |
| [`W-LINK-CROSS-SOURCE`](W-LINK-CROSS-SOURCE.md) | warning | A markdown link points to a file of another source while `inference.cross_source_links` is off. |
| [`W-REF-UNRESOLVED`](W-REF-UNRESOLVED.md) | warning | A frontmatter reference matches no note by identifier, path or title, several notes by title, or a note of a type the attribute does not accept. |

## Identifiers and types

| Check | Severity | Meaning |
|---|---|---|
| [`E-ID-DUP`](E-ID-DUP.md) | error | Two entities resolve to the same identifier. |
| [`E-ID-INVALID`](E-ID-INVALID.md) | error | A frontmatter `id` does not follow the identifier pattern; the file path gives the identifier instead. |
| [`E-TYPE-CONFLICT`](E-TYPE-CONFLICT.md) | error | The frontmatter `type` contradicts the type given by the file suffix. |
| [`E-FM-INVALID`](E-FM-INVALID.md) | error | The YAML frontmatter cannot be parsed. |
| [`E-META-REL`](E-META-REL.md) | error | A declared relation is not allowed between these two types by the profile. |
| [`E-ENCODING`](E-ENCODING.md) | error | A file is not valid UTF-8 and is skipped. |
| [`W-TYPE-UNKNOWN`](W-TYPE-UNKNOWN.md) | warning | The resolved type of a note is not declared by the profile; the note is treated as a document. |
| [`W-ATTRIBUTE-UNKNOWN`](W-ATTRIBUTE-UNKNOWN.md) | warning | A frontmatter attribute is declared neither by the type nor among the common attributes; it is kept as-is. |

## Documents

| Check | Severity | Meaning |
|---|---|---|
| [`W-CONV-FAILED`](W-CONV-FAILED.md) | warning | An office document could not be converted to PDF. |
| [`W-CONV-SUSPECT`](W-CONV-SUSPECT.md) | warning | A converted PDF contains no extractable text although the document is large. |
| [`W-DOC-NOMD`](W-DOC-NOMD.md) | info | A document has no markdown representation. |
| [`W-DUP-CANDIDATE`](W-DUP-CANDIDATE.md) | info | Two resources look like representations of the same document, but not enough to merge them. |

## Vocabulary and filing

| Check | Severity | Meaning |
|---|---|---|
| [`W-TERM-UNDEFINED`](W-TERM-UNDEFINED.md) | warning | A recurring expression is used across files without any note defining it. |
| [`W-TERM-UNUSED`](W-TERM-UNUSED.md) | info | A glossary term is never cited anywhere. |
| [`W-DOMAIN-UNCLASSIFIED`](W-DOMAIN-UNCLASSIFIED.md) | info | A note matches no declared domain. |
| [`W-DOMAIN-UNKNOWN`](W-DOMAIN-UNKNOWN.md) | warning | A frontmatter `domain` names no declared domain; it is kept as written. |
| [`W-APP-MISSING`](W-APP-MISSING.md) | warning | An entity resolves to no application. |
| [`W-APP-UNKNOWN`](W-APP-UNKNOWN.md) | warning | The resolved application is not declared in the configuration; it is kept as written. |
| [`W-STALE`](W-STALE.md) | warning | A source or a note has not changed for longer than the configured threshold. |
| [`I-REL-AMBIGUOUS`](I-REL-AMBIGUOUS.md) | info | A link between two entities fell back to the generic `related` relation. |
| [`I-TERM-HOMONYM`](I-TERM-HOMONYM.md) | info | Two entities share a title or an alias once spellings are compared; occurrences link to each at half confidence. |
| [`I-PII-DETECTED`](I-PII-DETECTED.md) | info | A personal name was detected in a transcript outside the pseudonymisation dictionary. |

## Contracts

| Check | Severity | Meaning |
|---|---|---|
| [`W-API-NOCONSUMER`](W-API-NOCONSUMER.md) | warning | An API has no consumer, declared or inferred. |
| [`W-API-CONSUMER-MISMATCH`](W-API-CONSUMER-MISMATCH.md) | warning | An API declares a consumer that never cites it, or a note cites an API that does not list it. |

## Plugins

| Check | Severity | Meaning |
|---|---|---|
| [`W-PLUGIN-DISABLED`](W-PLUGIN-DISABLED.md) | warning | A declared plugin needs a system tool that is not installed, so it was not registered; `info` when the tool is optional. |
