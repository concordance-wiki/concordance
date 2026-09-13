# Realistic corpus

Concordance described by itself, in 120 markdown notes per language (`en` and `fr`, same structure, translated names and text) plus two interface contracts: the pipeline, the site, the checks and the future service are the subject of every note. Every implemented type, every inference method and every file-level check appear at least once; the expected model and findings under `expected/` are the contract that the later stories verify.

Nothing in it is real: the people are `Participant-1` to `Participant-6`, and no company, city, brand or product exists.

## Sources

| Source | Content | Typing |
|---|---|---|
| `glossary` | 45 terms with aliases, `broader` and `narrower`, several multi-word terms, two homonym pairs (`link` is the title of one term and an alias of `explicit-link`; `index` is an alias of both `search-index` and `alphabetical-index`), one alias shorter than three characters (`id`) and three terms nobody cites | `type: term`, `glossary: true` |
| `specs` | 11 screens (`## Objects`, `## Actions`, `## Rules`, frontmatter `roles`, `reads`, `writes`, `url_pattern`), 3 APIs with `## Consumers` and `## Objects`, one OpenAPI contract with three operations and one WSDL with two, 6 operation notes with `operation_id`, 12 business objects with `lifecycle`, 4 data objects with `fields`, 10 rules with `## Applies to`, 5 processes with `## Steps`, 3 roles, 3 batches with `## Reads`, `## Writes` and `depends_on` | path rules per folder, `.rule.md` and `.table.md` suffixes, a last rule that also sets the application of `screens/service/**` |
| `decisions` | 7 decisions with `## Affects`; one supersedes another | `type: decision` |
| `meetings` | 6 design workshops written as notes, with pseudonymous `participants`, dates and the decisions they took | `default_type: meeting` |
| `framing` | 4 framing documents, plus `private/` which `privacy.exclude` removes before anything is read | `default_type: document`, `convert: true` |

Two applications: `concordance-cli` (active, the command line and the build) and `concordance-service` (target, the future long-running service, which owns the three `screens/service/` screens, the model query API and the forge bridge). Four domains resolved by globs on file names, `ingestion`, `inference` with the `recognition` subdomain, `publication` and `quality`; a few notes set `domain` in frontmatter instead. Links cross the sources with relative paths and once with the `specs:` prefix; `inference.cross_source_links` is on.

## Intended findings

The corpus is clean of errors: every link resolves, every identifier is unique, every frontmatter parses. The warnings and informations it must produce are listed in `expected/findings.yaml`:

- `I-REL-AMBIGUOUS` on the prose mention of a term in a screen;
- `W-API-CONSUMER-MISMATCH` on the model query API, which declares a consumer that never cites it, and `W-API-NOCONSUMER` on the forge bridge API, which nothing consumes;
- `W-APP-MISSING` on the framing note that declares no application while its source declares none either;
- `W-ATTRIBUTE-UNKNOWN` on a decision carrying an `owner` key;
- `W-DOMAIN-UNCLASSIFIED` on the notes outside every domain glob (two roles, four terms);
- `W-TERM-UNDEFINED` on `build summary` (`résumé de build`), used seven times in three files without a glossary note, and `W-TERM-UNUSED` on the three terms nobody cites, one of which is cited only under the excluded `private/` folder.

`expected/keywords.yaml` names that published expression and three expressions that must stay unpublished, among them `cold start` (`démarrage à froid`), twice in one file; `expected/links.yaml` lists sixty links covering every method of the confidence scale, as a minimum rather than an exhaustive list.

The checks that need git history, binary documents or transcripts (`W-STALE`, `W-CONV-*`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`, `I-PII-DETECTED`) are not exercised here; see the [faulty corpus](../faulty/en/README.md).

## Tests

`packages/ingest/test/markdown/realistic-parity.test.ts` checks that both languages have the same structure: files per source, frontmatter keys, section headings through a fixed translation map, and the same shape of expected entities, links, findings and keywords. `packages/typing/test/realistic.test.ts` checks that the type cascade yields exactly `expected/entities.yaml` and that its findings are listed in `expected/findings.yaml`; `packages/inference/test/explicit/corpus.test.ts` checks the explicit links. `scripts/validate.mjs` checks that every expected entity, link end and finding path names a file that exists.
