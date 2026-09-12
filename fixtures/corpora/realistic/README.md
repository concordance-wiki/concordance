# Realistic corpus

A fictional personal insurer, described in 120 markdown notes per language (`en` and `fr`, same structure, translated names and text) plus two interface contracts. Every implemented type, every inference method and every file-level check appear at least once; the expected model and findings under `expected/` are the contract that the later stories verify.

Nothing in it is real: the insurer is unnamed, the vocabulary is generic, the people are `Participant-1` to `Participant-6`, and no city, brand or product exists.

## Sources

| Source | Content | Typing |
|---|---|---|
| `glossary` | 45 terms with aliases, `broader` and `narrower`, several multi-word terms, two homonym pairs (`claim` is the title of one term and an alias of `claim-file`; `rate` is an alias of both `premium-rate` and `interest-rate`), one alias shorter than three characters (`DD`) and three terms nobody cites | `type: term`, `glossary: true` |
| `specs` | 11 screens (`## Objects`, `## Actions`, `## Rules`, frontmatter `roles`, `reads`, `writes`, `url_pattern`), 3 APIs with `## Consumers` and `## Objects`, one OpenAPI contract with three operations and one WSDL with two, 6 operation notes with `operation_id`, 12 business objects with `lifecycle`, 4 data objects with `fields`, 10 rules with `## Applies to`, 5 processes with `## Steps`, 3 roles, 3 batches with `## Reads`, `## Writes` and `depends_on` | path rules per folder, `.rule.md` and `.table.md` suffixes, a last rule that also sets the application of `screens/portal/**` |
| `decisions` | 7 decisions with `## Affects`; one supersedes another | `type: decision` |
| `meetings` | 6 meetings written as notes, with pseudonymous `participants`, dates and the decisions they took | `default_type: meeting` |
| `framing` | 4 framing documents, plus `private/` which `privacy.exclude` removes before anything is read | `default_type: document`, `convert: true` |

Two applications: `policy-admin` (active, the back office) and `member-portal` (target, the self-service portal, which owns the three `screens/portal/` screens and the member directory API). Four domains resolved by globs on file names, `membership`, `payments` with the `caps` subdomain, `claims` and `contracts`; a few notes set `domain` in frontmatter instead. Links cross the sources with relative paths and once with the `specs:` prefix; `inference.cross_source_links` is on.

## Intended findings

The corpus is clean of errors: every link resolves, every identifier is unique, every frontmatter parses. The warnings and informations it must produce are listed in `expected/findings.yaml`:

- `I-REL-AMBIGUOUS` on the prose mention of a term in a screen;
- `W-API-CONSUMER-MISMATCH` on the Claims API, which declares a consumer that never cites it, and `W-API-NOCONSUMER` on the member directory API, which nothing consumes;
- `W-APP-MISSING` on the framing note that declares no application while its source declares none either;
- `W-ATTRIBUTE-UNKNOWN` on a decision carrying an `owner` key;
- `W-DOMAIN-UNCLASSIFIED` on the notes outside every domain glob (two roles, four terms);
- `W-TERM-UNDEFINED` on `waiting period` (`délai de carence`), used nine times in four files without a glossary note, and `W-TERM-UNUSED` on the three terms nobody cites, one of which is cited only under the excluded `private/` folder.

`expected/keywords.yaml` names that published expression and three expressions that must stay unpublished; `expected/links.yaml` lists sixty links covering every method of the confidence scale, as a minimum rather than an exhaustive list.

The checks that need git history, binary documents or transcripts (`W-STALE`, `W-CONV-*`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`, `I-PII-DETECTED`) are not exercised here; see the [faulty corpus](../faulty/en/README.md).

## Tests

`packages/ingest/test/markdown/realistic-parity.test.ts` checks that both languages have the same structure: files per source, frontmatter keys, section headings through a fixed translation map, and the same shape of expected entities, links, findings and keywords. `packages/typing/test/realistic.test.ts` checks that the type cascade yields exactly `expected/entities.yaml` and that its findings are listed in `expected/findings.yaml`; `packages/inference/test/explicit/corpus.test.ts` checks the explicit links. `scripts/validate.mjs` checks that every expected entity, link end and finding path names a file that exists.
