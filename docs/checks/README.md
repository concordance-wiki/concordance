# Checks

Every finding produced by the build or the linter carries one of these identifiers. Severity prefixes: `E-` error, `W-` warning, `I-` info. Each page shows the situation before and after the fix.

Severities can be overridden under `checks:` in `concordance.yaml` or, per repository, in `concordance-lint.yaml`. The build fails according to `build.fail_on`; the linter fails according to `--fail-on`, `error` by default.

## Links

| Check | Severity | Meaning |
|---|---|---|
| [`E-LINK-BROKEN`](E-LINK-BROKEN.md) | error | A markdown link points to a file that does not exist in the source. |

## Identifiers and types

| Check | Severity | Meaning |
|---|---|---|
| [`E-ID-DUP`](E-ID-DUP.md) | error | Two entities resolve to the same identifier. |
| [`E-TYPE-CONFLICT`](E-TYPE-CONFLICT.md) | error | The frontmatter `type` contradicts the type given by the file suffix. |
| [`E-FM-INVALID`](E-FM-INVALID.md) | error | The YAML frontmatter cannot be parsed. |
| [`E-META-REL`](E-META-REL.md) | error | A declared relation is not allowed between these two types by the profile. |

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
| [`W-APP-MISSING`](W-APP-MISSING.md) | warning | An entity resolves to no application. |
| [`W-STALE`](W-STALE.md) | warning | A source or a note has not changed for longer than the configured threshold. |
| [`I-REL-AMBIGUOUS`](I-REL-AMBIGUOUS.md) | info | A link between two entities fell back to the generic `related` relation. |
| [`I-PII-DETECTED`](I-PII-DETECTED.md) | info | A personal name was detected in a transcript outside the pseudonymisation dictionary. |

## Contracts

| Check | Severity | Meaning |
|---|---|---|
| [`W-API-NOCONSUMER`](W-API-NOCONSUMER.md) | warning | An API has no consumer, declared or inferred. |
| [`W-API-CONSUMER-MISMATCH`](W-API-CONSUMER-MISMATCH.md) | warning | An API declares a consumer that never cites it, or a note cites an API that does not list it. |
