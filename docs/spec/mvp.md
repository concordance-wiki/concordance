# MVP specification

This document is the reference for the first version of Concordance. It consolidates the scope, the architecture, the reduced meta-model, the pipeline, and the user stories with their acceptance criteria. Anything deferred after the MVP is listed in [requirements.md](requirements.md).

## 1. Scope

The MVP is a static site generator that reads git repositories of markdown, records the occurrences of business words from one file to the next, and publishes one page per word. The core value is relating files by occurrence, not modelling.

No content rework is required before the first build. A page is built from recorded occurrences alone. Structured notes enrich the result; they do not condition it.

The principle that arbitrates every batch: every indexed word has a page. A page is made of the written markdown when it exists, at most five pieces of metadata, and the occurrences found elsewhere. An entity is nothing more than a keyword that owns a file of its name.

| | Content |
|---|---|
| In | git ingestion and markdown parsing; type cascade; global domains; occurrence index; entity page and keyword page; faceted search; conversion and preview of office documents and VTT transcripts; transcript pseudonymisation; twin resource reconciliation; OpenAPI and WSDL import; lint in CI on four families of checks; one-hop neighbourhood mini-map; theme and white label; accessibility; golden corpus; documentation; governance |
| Out | structural projections (navigation map, BPMN, CRUD matrix, impact lineage, domains, event choreography, batch calendar, timeline, test coverage, traceability, plateaus); curation and link promotion through merge requests; a health report screen; HTTP and MCP service; AI; embeddings; external sources (tracker, test reports, code analysis); exposing the confidence threshold; IDE extension |

The confidence score is computed and stored: it orders mentions and decides what is displayed. It is not shown, and no slider adjusts it.

## 2. Architecture

### 2.1 Naming

| Element | Value |
|---|---|
| Product | Concordance |
| GitHub organisation and npm scope | `concordance-wiki` |
| Command | `concordance`, alias `conc`. Documentation always writes the full name; the alias appears only in the quick start. |
| Core packages | `@concordance-wiki/core`, `/profile`, `/ingest`, `/typing`, `/nlp`, `/inference`, `/checks`, `/site`, `/ui`, `/cli`, `/lint` |
| Official plugins | `@concordance-wiki/plugin-reader-vtt`, `/plugin-reader-office`, `/plugin-convert-libreoffice`, `/plugin-contract-openapi`, `/plugin-contract-wsdl`, `/plugin-viewer-pdf`; the contract viewer is a UI component of the default theme, in `/site` |
| Preset | `concordance` (unscoped): depends on the core and every official plugin |
| Configuration | `concordance.yaml` in a configuration repository, with `profile.yaml`, `theme.yaml`, `stopwords.*.txt`, `pseudonyms.yaml` (never published) |
| Lock | `concordance.lock.yaml`; only `rejected_terms` is read in the MVP |
| Per-repository override | `concordance-lint.yaml` |
| Outputs | `dist/`, `dist/model.json`, `dist/build.log.json`, `dist/metrics.json` |
| Published schemas | `schemas/config.schema.json`, `profile.schema.json`, `model.schema.json`, `lock.schema.json`, `theme.schema.json`, `plugin.schema.json` |

The binary name is independent from the npm package name.

### 2.2 Structuring decisions

The decisions that constrain the MVP are stated in the [architecture guide](../guides/architecture.md): standard markdown only; static generation in a pipeline; declarative profile; confidence and provenance on every link; PDF preview at build; lock file; TypeScript monorepo; no database; deterministic identifiers; findings instead of failures; bounded neighbourhood; keyword page threshold; paginated mentions; core, plugins and preset; locale per source.

### 2.3 Packages

| Package | MVP responsibility | Depends on |
|---|---|---|
| `@concordance-wiki/core` | model types, JSON schema, identifier computation, canonical sorting, deterministic utilities, plugin API | — |
| `@concordance-wiki/profile` | profile loading, validation and merge; allowed relation matrix | core |
| `@concordance-wiki/ingest` | git clone, file reading, markdown and frontmatter parsing | core |
| `@concordance-wiki/typing` | type cascade, global domain resolution | core, profile |
| `@concordance-wiki/nlp` | normalisation, Aho-Corasick, n-grams, C-value, stopwords, MinHash, language packs `en` and `fr` | core |
| `@concordance-wiki/inference` | link production, confidence combination, bounded neighbourhood | core, ingest, nlp, profile |
| `@concordance-wiki/checks` | check registry, shared by build and linter | core, profile |
| `@concordance-wiki/site` | site generation, templates, theme, search index | core, profile |
| `@concordance-wiki/ui` | front-end components: mentions panel, mini-map, viewer slots | — |
| `@concordance-wiki/cli` | `build`, `render`, `init`, `validate-config`, `lint` | all |
| `@concordance-wiki/lint` | distributable linter: binary, CI component, action, image, hook | core, profile, typing, checks, ingest |

Readers for VTT and Office metadata, the LibreOffice converter, the contract importers and the viewers are plugins under `plugins/`. The core never imports a plugin.

### 2.4 Pipeline

A single command, `concordance build`, chains eight deterministic steps. Each is testable in isolation and produces an intermediate artefact in the cache.

| # | Step | Input → output | Batch |
|---|---|---|---|
| 1 | Configuration | configuration repository → validated configuration, merged profile | L0 |
| 2 | Ingestion | git repositories → file tree with commit and last-modified date | L0 |
| 3 | Parsing | markdown files → syntax tree, frontmatter, sections, links | L0 |
| 4 | Typing | files → typed entities with identifier, application, domain | L0 |
| 5 | Conversion | office files → PDF, thumbnails, extracted text (plugins, parallel, cached) | L4 |
| 6 | Inference | entities and texts → links with confidence and provenance, term candidates, neighbourhood | L1 |
| 7 | Checks | model → findings | L6 |
| 8 | Rendering | `model.json` → `dist/`: pages, JSON fragments, search index, previews | L2 |

## 3. Meta-model reduced to the MVP

The default profile defines thirty-five types and twenty relations. The MVP implements a subset, but the engine stays generic: the reduction is a matter of `status` in `packages/profile/default.yaml`, not of code. A project can reintroduce the missing types without modifying the engine.

### 3.1 Implemented types

| Group | Types |
|---|---|
| Containers | `application`, `domain` |
| Business | `role`, `process`, `business_object`, `rule`, `term` |
| Application | `screen`, `api`, `endpoint`, `batch`, `data_object` |
| Motivation | `decision` |
| Raw sources | `document`, `meeting` |
| Planned | `actor`, `business_event`, `business_service`, `representation`, `function`, `channel`, `message`, `application_event`, `goal`, `requirement`, `constraint`, `principle`, `standard`, `work_package`, `backlog_item`, `milestone`, `plateau`, `gap`, `test_strategy`, `test` |

`endpoint` is kept because the API note depends on it. Everything event-related is out because it has no screen in the MVP; `standard` and `test` are out because they assume deferred views.

### 3.2 Implemented relations

| Relation | Allowed pairs | Attributes |
|---|---|---|
| `composes` | application → screen, api, process, batch | — |
| `assigned_to` | role → process, screen | — |
| `serves` | api → screen; endpoint → screen; screen → process | — |
| `exposes` | api → endpoint | — |
| `accesses` | screen, api, batch → business_object, data_object | `mode` |
| `triggers` | screen → screen | `condition`, `label` |
| `constrains` | rule → screen, process, business_object, api | — |
| `represents` | data_object → business_object; term → business_object | — |
| `specializes` | term → term; business_object → business_object | — |
| `affects` | decision → any | — |
| `documents` | document, meeting → any | — |
| `related` | universal fallback, undirected | cap 0.6 |

### 3.3 Confidence scale

| Method | Confidence | Recorded provenance |
|---|---|---|
| `explicit_link` | 1.00 | file, line, link text |
| `contract_import` | 0.95 | contract URL, operation name |
| `frontmatter_ref` | 0.90 | attribute |
| `folder_zone` | 0.90 | path |
| `section_mention` | 0.70 | section, line |
| `glossary_occurrence` | 0.60 base, +0.05 per occurrence, cap 0.80; homonyms halved; recognised type prefix +0.10 | line and 80-character context per occurrence |
| `cooccurrence` | 0.40 | paragraph |

`embedding` and `lock_promoted` are not implemented in the MVP. When several methods produce the same source-target-relation triple, the retained confidence is `1 − Π(1 − cᵢ)`, capped at 1, and every provenance is kept.

Relation type determination: mapped section → typed frontmatter attribute → type pair admitting a single relation → `related` (cap 0.6, finding `I-REL-AMBIGUOUS`).

### 3.4 Checks

Four families, plus the contract checks and the plugin checks. Each check is a pure function `(model) → findings[]` in a registry shared by the build and the linter, with an identifier, a default severity, a description, a remediation and a [documentation page](../checks/README.md).

| Family | Checks |
|---|---|
| Sources | `W-SOURCE-UNREACHABLE` |
| Links | `E-LINK-BROKEN`, `W-LINK-CROSS-SOURCE`, `W-REF-UNRESOLVED` |
| Identifiers and types | `E-ID-DUP`, `E-ID-INVALID`, `E-TYPE-CONFLICT`, `E-FM-INVALID`, `E-META-REL`, `E-ENCODING`, `W-TYPE-UNKNOWN`, `W-ATTRIBUTE-UNKNOWN` |
| Documents | `W-CONV-FAILED`, `W-CONV-SUSPECT`, `W-DOC-NOMD`, `W-DUP-CANDIDATE` |
| Vocabulary and filing | `W-TERM-UNDEFINED`, `W-TERM-UNUSED`, `W-DOMAIN-UNCLASSIFIED`, `W-DOMAIN-UNKNOWN`, `W-APP-MISSING`, `W-APP-UNKNOWN`, `W-STALE`, `I-REL-AMBIGUOUS`, `I-TERM-HOMONYM`, `I-PII-DETECTED` |
| Contracts | `W-CONTRACT-UNREACHABLE`, `W-OPERATION-AMBIGUOUS`, `W-OPERATION-UNMATCHED`, `W-API-NOCONSUMER`, `W-API-CONSUMER-MISMATCH` |
| Plugins | `W-PLUGIN-DISABLED` |

## 4. Batches and stories

Seventy stories in ten batches, ordered by dependency. L0 to L3 form the minimum demonstrable base; L4 to L7 are independent from each other and can run in parallel; L8 runs throughout; L9 dresses the site once the pages exist.

### L0 — Foundation and ingestion

Nothing is visible at the end of this batch, and everything depends on it. Exit criterion: two successive builds on unchanged sources produce byte-identical files.

#### L0-01 Monorepo and build toolchain

As a developer, I want a ready-to-use monorepo so that I can start writing domain code without arbitrating tooling.

- pnpm workspaces, strict TypeScript, ESM, Node LTS target.
- The core packages (`core`, `profile`, `ingest`, `typing`, `nlp`, `inference`, `checks`, `site`, `ui`, `cli`, `lint`) exist, compile empty and expose their entry point; `plugins/` and `presets/` are ready to receive theirs.
- A single command (`pnpm check`) builds, tests, lints and type-checks everything.
- The CI pipeline runs that command on every merge request and publishes coverage.
- The quality gate requires 100% line and branch coverage; mutation testing is configured on `core`, `typing`, `nlp`, `inference`, `checks` with an 85% threshold.
- The hygiene scan (forbidden file names, trailers) and the schema and fixture validation are part of `pnpm check`.

#### L0-02 Configuration validated before any processing

As an integrator, I want my configuration checked and its errors reported plainly so that I do not discover a typo after forty minutes of build.

- `concordance validate-config` validates `concordance.yaml` against a published JSON schema and prints a readable report: path of the faulty key, received value, expected values.
- Exit code is 0 when the configuration is valid, 1 otherwise.
- Domain globs are checked syntactically; a glob that matches no file yields a warning, not an error.
- A source declared twice under the same name is an error.
- `concordance build` runs this validation as its first step and stops when it fails.
- `concordance init` writes a minimal, commented, valid configuration.
- The schema covers the MVP subset: `project`, `profile`, `plugins`, `applications`, `domains`, `privacy`, `sources`, `staleness`, `inference`, `conversion`, `build`, `checks`. The `lock` key and `tracker` sources are accepted but ignored with a warning.

Depends on: L0-01.

#### L0-03 Source cloning and caching

As an integrator, I want the build to fetch my repositories without modifying them so that the tool can never damage my sources.

- Each source is cloned at depth 1 on the declared ref, or updated when already cached.
- Nothing is written into source repositories; verified by a test comparing the working tree fingerprint before and after the build.
- The exact commit and last-modified date of every file are recorded and carried through to the model.
- An unreachable repository yields a finding and does not stop the build; entities from that source are absent from the model.
- A local source (a file path, without git) is accepted for development, with the file system date in place of the commit.
- `privacy.exclude` patterns are applied before any content is read.

Depends on: L0-02.

#### L0-04 Markdown and frontmatter parsing

As the engine, I want a usable representation of every markdown file so that I can extract entities and links from it.

- CommonMark and GFM parser (tables, task lists) plus YAML frontmatter.
- Extracted: the H1 title, H2 sections with their content, ordered and bullet lists, tables, markdown links with line and text, image links, code blocks, block quotes.
- Relative links are resolved against the file, then against the source root; anchors are kept in the provenance.
- Invalid YAML frontmatter yields an `E-FM-INVALID` finding; the body is still processed.
- A frontmatter attribute absent from the type schema yields a finding and is kept as-is in the model.
- Non-UTF-8 encoding yields a finding; the file is skipped.

Depends on: L0-03.

#### L0-05 Deterministic identifiers

As the author of a link, I want a note's address to stay the same from one build to the next so that my links and bookmarks remain valid.

- The identifier is `<source>/<relative path without extension or type suffix>`, slugified.
- An `id` declared in frontmatter takes precedence.
- Never a random identifier nor one that depends on processing order.
- Two entities with the same identifier yield an `E-ID-DUP` finding; the first in canonical sort order is kept.
- The identifier determines the page URL in the site.

Depends on: L0-04.

#### L0-06 Type cascade

As an integrator, I want to type my notes by filing convention rather than by editing every file so that I can use an existing corpus without reworking it.

- Increasing precedence: the source's `default_type`, the source's `type`, `rules` evaluated in order (the last match wins), then frontmatter.
- Rules accept `path` globs, `suffix`, `ext` and `frontmatter` criteria.
- The type origin is kept on the entity as `source`, `rule#3`, `suffix` or `frontmatter`, and shown in the site.
- A frontmatter `type` contradicting the file suffix yields an `E-TYPE-CONFLICT` finding.
- A type unknown to the profile yields a finding; the entity is treated as `document`.
- A markdown resource whose resolved type is `document` or `meeting` enters the graph only through the `documents` relation.

Depends on: L0-05, L0-08.

#### L0-07 Global domains, orthogonal to sources

As an architect, I want a business domain to group notes from several repositories so that filing by document kind does not impose its structure on the business.

- Domains are declared globally and resolved by globs evaluated across all sources.
- Subdomains are resolved after their parent, and the most specific wins.
- A domain declared in frontmatter takes precedence over globs.
- A note outside any domain is attached to the "unclassified" domain and yields a `W-DOMAIN-UNCLASSIFIED` finding.
- The application is resolved by the same cascade; an entity without an application yields a `W-APP-MISSING` finding.

Depends on: L0-06.

#### L0-08 Profile loaded, validated and merged

As an integrator, I want to extend the meta-model without touching the code so that I can add a type specific to my organisation.

- The default profile is embedded; the project profile is merged on top, key by key.
- The resulting profile is schema-validated: types, attributes, relations, allowed pairs, mapped sections, confidence scale.
- A fingerprint of the merged profile is recorded in the model so that two builds can be compared.
- A type can be added, an attribute extended, a relation allowed on a new pair, without modifying the engine; verified by a test that loads a profile adding a type.

Depends on: L0-02.

#### L0-09 Error tolerance through findings

As an integrator, I want a faulty file not to fail the whole build so that I get a usable site on the first try on an imperfect corpus.

- Every anomaly becomes a finding carrying an identifier, a severity, a file path, a line when there is one, a message and a remediation.
- No content anomaly stops the build.
- The build fails only according to `build.fail_on`: on errors, and beyond a number of unconverted documents.
- Findings are written to `dist/build.log.json` and to `model.json`.
- The end-of-build summary reports entities per type, links per method and findings per severity.

Depends on: L0-04.

#### L0-10 Determinism verified

As the pipeline owner, I want two identical builds to produce identical files so that I can distribute the model through git and diff the changes.

- Entities are sorted by identifier, links by the source-target-relation triple, provenances by method, path and line.
- No timestamp nor random value in the outputs, apart from the explicitly dated `build` block.
- An integration test builds the golden corpus twice and compares the fingerprints of `model.json` and of the `dist/` tree.
- Conversion parallelism does not change the order of outputs.

Depends on: L0-05, L0-09.

#### L0-11 Plugin API and registry

As a contributor, I want to add a format reader or an importer without touching the core so that the core stays installable everywhere.

- `@concordance-wiki/core` exposes a versioned plugin API (`apiVersion`) with eight contribution points: `reader`, `converter`, `source`, `inference method`, `check`, `projection`, `ui component`, `theme`.
- A plugin is a package exporting a `definePlugin` function that returns a manifest validated by `schemas/plugin.schema.json`: name, version, `apiVersion`, contributions, declared system dependencies.
- Plugins are declared in `concordance.yaml` under `plugins:` (package name and options); they are loaded in declared order and registered in a deterministic registry.
- A plugin whose declared system dependency is missing disables itself with a finding; the build continues.
- A plugin with an incompatible `apiVersion` yields an explicit configuration error.
- The core imports no plugin; a dependency test verifies it.
- A minimal example plugin in the fixtures exercises every contribution point.

Depends on: L0-02, L0-08.

#### L0-12 Locale per source

As the integrator of a mixed corpus, I want to declare the language of each source so that word recognition follows the rules of the right language.

- Each source accepts `locale: en | fr`; otherwise the project locale (`project.locale`, default `en`).
- The locale selects a language pack: normalisation, plural rules, default stopwords, recognised type prefixes, collation.
- The `en` and `fr` packs are in the core; an unknown locale yields a configuration error unless a plugin provides it.
- The locale of every entity is recorded in the model.
- The golden corpus exists in `en` and `fr`; a test verifies that the same corpus yields the same occurrences in both languages.

Depends on: L0-02, L0-11.

#### L0-14 Folder domains

As an integrator, I want a domain to be recognised by the name of a folder of the corpus, without listing its files or writing one glob per source, so that the structure of the repositories carries the filing.

- A domain accepts `folder: true` or `folder: <name>`: it claims every file one of whose directory segments, the file name excluded, equals its identifier or the given name, in any source.
- A subdomain declared by folder claims only the files whose segment lies under its parent's folder; when the parent is declared by globs, the segment may sit anywhere on a path the parent's globs match.
- `folder` and `match` combine on the same domain; the precedence stays the frontmatter `domain`, then the deepest claiming domain, then the last declared. The origin `folder` is recorded next to `frontmatter`, `glob` and `unclassified`.
- A domain with neither `match` nor `folder` stays a frontmatter-only domain.
- A `folder` name that is not a single path segment is a configuration error reported by `validate-config`.
- The golden corpus declares a domain by folder and a folder subdomain.

Depends on: L0-07.

### L1 — Word and occurrence index

The heart of the product. This batch is what makes an unprepared corpus browsable. Exit criterion: on the golden corpus, every expected occurrence is recorded with its line and context, and no stray occurrence appears inside a code block.

#### L1-01 Text normalisation

As the engine, I want to compare "Keyword Page", "keyword pages" and "keyword page" as a single form so that I record the real occurrences of a term.

- Lower-casing, accent stripping for comparison, original form kept for display.
- Simple plural rules per locale (`en`: -s, -es, -ies; `fr`: -s, -x, -aux, -eux).
- Matches happen on word boundaries: "source" does not match inside "resource".
- Normalisation is a pure function, tested on a named case set covering accents, case, plurals, hyphens and apostrophes, in both locales.

Depends on: L0-12.

#### L1-02 Recognition dictionary

As the engine, I want the list of every word to recognise so that I know what to look for in the texts.

- The dictionary is built from the titles and aliases of every entity, with priority to sources declared as glossary sources (`inference.glossary_sources`).
- Homonyms (same normalised form, two entities) are kept and flagged; the occurrence yields a link to each, at half confidence.
- A term shorter than three characters is excluded unless it appears in a configuration allow-list (`inference.short_terms`).
- Configured stopwords are excluded from the dictionary.

Depends on: L1-01.

#### L1-03 Occurrence scan

As a reader, I want to see where a word is used and in which sentence so that I understand its real meaning in my organisation.

- An Aho-Corasick automaton built once on the dictionary, then a single pass per document.
- An expression contained in a longer recognised expression is not counted twice: "keyword page" beats "page". Two expressions that only partly overlap ("build log" and "log summary" in "the build log summary") are both counted, since each may name a different entity.
- Each occurrence carries the file, line, position, enclosing section and an 80-character centred context.
- Recognised type prefixes ("screen X", "API Y", "table Z", configurable per locale) add 0.1 confidence and fix the expected target type.
- Performance: the scan on a 2,000-file corpus runs in under ten seconds on a development machine.

Depends on: L1-02.

#### L1-04 Zones excluded from recognition

As a reader, I want the tool not to count a code variable as a business mention so that the displayed numbers are credible.

- Excluded: fenced and indented code blocks, inline code, URLs, frontmatter, and link targets.
- The visible text of a markdown link remains subject to recognition.
- A test verifies that a term present only in a code block yields no occurrence.

Depends on: L1-03.

#### L1-05 Links written in notes

As an author, I want my markdown links to be authoritative so that what I wrote explicitly comes before what the tool guesses.

- Every markdown link resolved to a note yields a link at confidence 1.00, method `explicit_link`.
- The provenance records the file, the line and the link text.
- A link to a missing file yields an `E-LINK-BROKEN` finding and no link in the model.
- A link to an existing non-markdown file yields a `documents` relation to the resource.
- Cross-source links are resolved when the configuration allows it (`inference.cross_source_links`), flagged otherwise.

Depends on: L0-04, L0-05.

#### L1-06 Frontmatter references

As an author, I want to declare relations in the note header so that I can structure without weighing down my text.

- Reference-typed attributes of the profile are resolved by identifier, by path, then by exact title.
- The produced relation is the one the profile associates with the attribute, with its attributes; thus `reads` yields `accesses` in `read` mode.
- Confidence 0.90, method `frontmatter_ref`, provenance on the attribute name.
- An unresolved reference yields a `W-REF-UNRESOLVED` finding and no link.

Depends on: L0-08, L1-05.

#### L1-07 Mentions in a typed section

As an author, I want a mention under a known section heading to count more than a mention lost in a paragraph so that I am rewarded when I organise my content.

- Sections mapped in the profile yield the declared relation for every mention they contain.
- Confidence 0.70, method `section_mention`, provenance on the section name and line.
- Section heading matching is case- and accent-insensitive, and accepts the labels of every profile locale (`## Objects`, `## Objets`).
- A mention outside a mapped section falls back to `glossary_occurrence`.

Depends on: L1-03, L1-06.

#### L1-08 Confidence combination and full provenance

As a reader, I want to know why the tool claims one note is linked to another so that I can verify it myself.

- When several methods yield the same source-target-relation triple, the retained confidence is `1 − Π(1 − cᵢ)`, capped at 1.
- Every provenance is kept, none is overwritten.
- An additional glossary occurrence adds 0.05, capped at 0.80.
- Combination is a pure function, tested on named cases including a three-method case, and by properties (bounds, commutativity).

Depends on: L1-05, L1-06, L1-07.

#### L1-09 Relation type determination

As the engine, I want to name the relation between two entities so that the site can say "is entered on" rather than "is related to".

- Order of application: mapped section, then typed frontmatter attribute, then a type pair admitting a single relation in the profile, then `related`.
- A `related` relation is capped at 0.6 and yields an `I-REL-AMBIGUOUS` finding, unless co-occurrence alone knows the link.
- A relation declared outside the profile matrix yields an `E-META-REL` finding and does not enter the model.
- Displayed relation labels come from the profile, never from the code.

Depends on: L1-08.

#### L1-10 Neighbourhood bounded to the K nearest

As the pipeline owner, I want the proximity computation to stay tractable on a large corpus so that the published model does not become unmanageable.

- Co-occurrence is recorded per paragraph, confidence 0.40, method `cooccurrence`.
- Only the K best neighbours of each node are kept, K being 50 by default and configurable (`inference.neighbours.k`).
- Ranking is by co-occurrence count, then by identifier to guarantee determinism on ties.
- The full matrix is never materialised in memory: the computation accumulates per paragraph.
- A load test on 5,000 entities verifies that memory stays under a declared threshold.

Depends on: L1-03.

The output feeds the mini-map (L7) and the accompanying-words panel (L2-05).

#### L1-11 Recurring unreferenced expressions

As a glossary owner, I want to see the expressions everyone uses without having defined them so that I know what to document first.

- N-grams of 1 to 4 words are generated over notes and documents.
- Excluded: n-grams starting or ending with a stopword, those made only of digits, those under a minimum length, those already in the dictionary, and those listed in the lock's `rejected_terms`.
- Ranked by C-value multiplied by IDF; an n-gram contained in a longer, more frequent one is penalised.
- Default thresholds: three occurrences and two distinct documents.
- The output carries, for each candidate, its score, its occurrences and their contexts.
- A `W-TERM-UNDEFINED` finding is produced above a score threshold.

Depends on: L1-04.

#### L1-12 Keyword page publication threshold

As the pipeline owner, I want to control the number of generated pages so that the site does not go from two thousand to fifty thousand files without my deciding it.

- A keyword page is generated only from three occurrences in at least two distinct files.
- The threshold is exposed in configuration under `inference.keyword_pages` (`min_occurrences`, `min_files`).
- Below the threshold, the word remains findable through full-text search but has no page.
- The build summary reports the number of keyword pages generated and the number of expressions discarded by the threshold.
- A test verifies that lowering the threshold increases the page count and raising it decreases it.

Depends on: L1-11.

### L2 — Canonical model and pages

The batch that makes the work visible. Exit criterion: on the golden corpus, every word above the threshold has a page reachable in three clicks from the home page, and that page shows its rendered markdown before any metadata.

#### L2-01 Serialised canonical model

As the site developer, I want a single file describing the whole model so that I can render pages without re-reading the sources.

- `model.json` contains the `build`, `entities`, `links`, `findings` and `candidates` blocks.
- The `build` block carries the tool version, the timestamp, the profile fingerprint and, per source, its name and commit.
- Each entity carries its identifier, type, title, locale, application, domain, type origin, attributes and source with path and line.
- Each link carries source, target, relation, attributes, confidence and the complete list of its provenances.
- The file is validated by `schemas/model.schema.json`, published with the tool.
- A Cypher export is provided for those who want to load the graph elsewhere.

Depends on: L1-09, L1-12.

#### L2-02 Site generation

As an integrator, I want a folder publishable as-is so that I can drop it on forge pages or a bucket without a server.

- `concordance render` reads `model.json` and writes `dist/`: one HTML page per entity and per keyword, the JSON fragments, the search index, the previews and the static assets.
- The site works over `file://` as well as behind a server, without URL rewriting configuration.
- URLs follow the entity identifier and stay stable from one build to the next.
- The main content of every page is present in the served HTML, without executing JavaScript.
- A page weighs under 150 KB excluding previews.

Depends on: L2-01.

#### L2-03 Entity template, markdown first

As a reader, I want to read what someone wrote on the subject so that I understand before I analyse.

- The page order is imposed: type badge and two qualifying properties, title, then the rendered markdown at full column width.
- The rendered markdown keeps its headings, lists, tables, quotes, code blocks and repository images.
- Declared metadata sits in the side panel, never between the title and the text.
- Highlighted properties are capped at five; beyond that they stay in the panel.
- A single template serves every type; only the displayed properties and the neighbour order change, both defined by the profile.
- Written links and recognised words are visually distinguished in the text, with a legend.
- The footer shows the source file path and an edit link to the forge.

Depends on: L2-02.

#### L2-04 Keyword page without a note

As a reader, I want a page for a word nobody has defined so that I still understand what it is about.

- The page uses the same template, without the markdown and declared properties.
- A banner explains that no note exists and states the number of passages recorded.
- Three numbers only: occurrences, files, sources.
- Passages are listed grouped by file, in corpus order, with their context.
- Accompanying words are shown, sized by co-occurrence frequency.
- Expressions with a similar form are offered as a lead, worded so as to assert nothing.
- If a note is created later, the page keeps its URL and fills in.

Depends on: L2-03, L1-10, L1-11.

#### L2-05 Mentions panel, in two sections

As a reader, I want to distinguish what someone wrote from what the tool found so that I know what to trust.

- Two clearly separated sections: links written in notes, and files that merely cite the entity.
- Mentions are grouped by file, each group collapsible, with its count.
- The first twenty mentions are in the served HTML; the rest is loaded on demand from a JSON fragment specific to the entity.
- One fragment per entity, never a global index; verified by a test on the size of produced files.
- The panel offers sorting, filtering and a "collapse all".
- Without JavaScript, the first twenty mentions remain readable and the links work.
- The threshold of twenty is configurable (`build.mentions_inline`).

Depends on: L2-03, L1-10.

#### L2-06 Home page with three entry points

As a newcomer, I want to understand in ten seconds where to start so that I do not close the tool.

- A prominent search field, accompanied by the most cited words as shortcuts.
- Three entry points of equal standing: by file tree, by alphabetical word index, by freshness.
- The freshness entry shows the latest changes with their git date and flags dormant sources according to the configured thresholds (`staleness`).
- The header states the number of sources, files and the date of the last build.
- No dashboard, no maturity metric, no chart.

Depends on: L2-02.

#### L2-07 Alphabetical index

As a reader, I want to browse every indexed word so that I discover the vocabulary without knowing what to search for.

- Navigation by initial letter, letters without entries being visibly inactive.
- Each entry carries its type glyph when it has one, the "no note" mark otherwise, and its citation count.
- Sorting follows the collation rules of the project locale, accents included.
- The index is paginated or segmented to stay under the page weight budget.

Depends on: L2-02, L0-12.

#### L2-08 Theme and white label

As an organisation, I want the site to carry my name and colours so that it does not look like a third-party tool.

- The project name, logo, accent colour, corner radius and font families come from `theme.yaml`, validated by `schemas/theme.schema.json`.
- An additional project stylesheet can be injected after the tool's own.
- No mention of the tool is imposed in the interface; a discreet mention is optional.
- Light and dark modes, following the system preference and remembered.
- The accent colour never carries information on its own.

Depends on: L2-02.

#### L2-09 Accessibility

As a screen reader user, I want access to the same information as everyone else so that I do not depend on a third party.

- Minimum contrast of 4.5:1 for body text, 3:1 for headings.
- Full keyboard navigation, consistent tab order, always-visible focus.
- Every graphical view has a structured textual equivalent, present in the HTML and indexed.
- Collapsibles, tabs and fields carry their ARIA roles and states.
- An automated audit (axe-core) runs in continuous integration and fails on any serious or critical violation.

Depends on: L2-03.

#### L2-10 Pinnable navigation trail

As an investigator, I want to keep track of the path I followed so that I can resume or share it.

- The trail shows the entities visited in order, each clickable.
- The trail is encoded in the URL, hence shareable and restored on reload.
- A pinned trail is kept locally between visits.
- The trail is bounded in length, the oldest entries being condensed.

Depends on: L2-03.

#### L2-11 To-do page

As a writer, I want a page listing what is missing so that I know where to start without reading a health report.

- A `todo` page lists two things only: documents without a markdown representation (`W-DOC-NOMD`) and words above the threshold without a note (`W-TERM-UNDEFINED`).
- Each entry leads to the page concerned and states the number of occurrences or files.
- Lists are sorted by decreasing occurrence count, then by identifier.
- The page is reachable from the home page and the header, with its count.
- No other finding appears there: it is not a health report.

Depends on: L2-04, L1-12.

#### L2-12 Islands architecture and slot registry

As a reader, I want pages that read without JavaScript and interactive components that load only what they need so that the site is fast and robust everywhere.

- HTML is rendered at build time by Preact components (`preact-render-to-string`); the published HTML contains the full content of every page.
- Only interactive components are hydrated (islands), each with its props serialised in the page; a page without an island loads no framework JavaScript.
- Client bundles are produced by esbuild, one per island, with hashed names, loaded with a deferred classic script so that a page opened from the disk runs them in every browser; two builds give byte-identical bundles.
- The site is a set of named slots (`Shell`, `Header`, `Footer`, `Home`, `EntityPage`, `KeywordPage`, `MentionsPanel`, `Neighbourhood`, `SearchResults`, `Index`, `Todo`) with a typed, documented view model; the default theme implements every slot.
- A theme brought by a plugin (`theme` contribution, `components` field) overrides any slot with a component receiving the same props; slots it does not provide come from the default theme; an example theme in the fixtures overrides one slot and is tested.
- Native CSS: cascade layers `tokens, base, components, project`, custom properties generated from `theme.yaml`, `color-scheme`, `prefers-reduced-motion`; the project's `stylesheet:` enters the `project` layer.
- A budget measured in CI: 150 kB per page excluding previews, the size of each island bundle announced in the build summary.

Depends on: L2-02, L2-08.

#### L2-13 Component gallery

As a theme author, I want to see every slot rendered with representative data so that I can restyle the site without building a corpus.

- A `concordance gallery` command (or a `--gallery` build flag) renders every slot with fixture view models into a static page set.
- Every theme override is visible there.
- The gallery is built in CI and its pages pass the accessibility checks of L2-09.

Depends on: L2-12.

#### L2-14 Interface localisation

As a French- or English-speaking reader, I want a site entirely in my language, dates and plurals included.

- Every label comes from a per-locale message catalogue in ICU MessageFormat, FormatJS JSON (`messages/en.json` source with `defaultMessage` and `description`, flat translations per locale); no visible string is hard-coded in a component.
- Message identifiers are typed from the source catalogue: a missing key or variable is a compile error.
- A test verifies each shipped locale carries every key of the source with the same variables; `en` and `fr` ship complete.
- Messages are resolved at build; the published HTML carries the final strings and no localisation library runs in the browser; islands receive their labels as props.
- Dates, numbers and relative durations go through `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` of the project locale.
- `theme.yaml › labels` overrides any message with the same syntax; an invalid override (unknown variable) is a configuration error.
- The page language (`lang`) and direction (`dir`) are set on the document; stylesheets use logical properties.

Depends on: L2-03, L2-08.

#### L2-15 Types as modules

As the architect of a team, I want to declare my own resource types in a distributable module format and give them a dedicated rendering in my theme, so that I extend Concordance to my domain without touching the engine, while a correct generic rendering remains when I have nothing specific to say.

- A type is a folder `types/<slug>/`: `type.yaml` (what the default profile declares for the type today, without its labels), `template.md` (the note template), `messages/<locale>.json` (the labels of the type, its attributes and its sections, in the ICU/FormatJS format of the interface catalogues), optionally `schema.json` (the JSON Schema of the items of its `list` attributes) and `components/` (rendering overrides). The format is published by `packages/core/schemas/type-module.schema.json` and documented.
- The core types are rewritten in that format under `packages/profile/types/`; the default profile is assembled from those folders when the package is built, and a test verifies the assembly equals the published profile: same identifiers, relations and templates; `docs/templates` and the templates of the command line stay synchronised from the modules, and `scripts/validate.mjs` checks all of it.
- A new contribution point `types` in the plugin API: a plugin ships one or more modules, registered at load in declared order and merged into the profile as the project's `profile.yaml` is; a type declared by two plugins is a configuration error, a type that extends a core type goes through `profile.yaml`. A project's `profile.yaml` may also point at a local folder of modules (`types_dir`).
- The `EntityPage` view model exposes the type declaration (attributes, sections, `display`) and every attribute of the note, declared and unknown, the unknown ones in an "other attributes" section kept as written; the generic template therefore displays any note of any type without specific code.
- Component resolution per type with fallback: a theme (`components`) or a type module (`components/`) may provide `EntityPage@<slug>`, resolved before `EntityPage`; likewise `Attribute@<attribute>` for an attribute value and `Section@<section>` for a mapped section. Priority: project theme, type module, default theme; documented and tested with the example plugin of the fixtures, which contributes a `runbook` type with its dedicated page.
- The gallery shows every registered type, core and plugins, with the generic template and, when it exists, its dedicated component; the accessibility checker passes on each.
- `concordance init --templates` also copies the templates of the types contributed by the plugins declared in `concordance.yaml`.
- Documentation: a guide "Adding a type" (module format, complete example, publication as a plugin), a "Rendering per type" section of the theming guide, the plugins guide updated, the architecture guide touched where it describes the profile.

Depends on: L2-02, L2-12, L2-13, L0-11.

### L3 — Search

Exit criterion: a search on the golden corpus returns results in under 100 ms after typing, without a server, and facet counts match the number of filtered results exactly.

#### L3-01 Search index generated at build

As a reader, I want to search the whole corpus without waiting so that I use the tool as a reflex.

- Search index generated at build, fragmented, loaded in pieces as the user types; the index files are classic scripts so that they load from a `file://` page, where a fetched index would not.
- Indexed fields: title, aliases, summary, body, type, application, domain, status, source.
- The text extracted from converted documents is indexed, truncated to a configurable size.
- Search works over `file://`.
- The index weight is reported in the build summary.
- Keyboard shortcut `/` reaches the field, `Escape` leaves it.

Depends on: L2-02.

#### L3-02 Facets

As a reader, I want to narrow my results by type and by source so that I find a note among two hundred documents.

- Facets on type, source, domain and application, with counts frozen at build.
- Facets combine, and filtering happens in the browser.
- A facet with no result under the current filters is disabled, not hidden.
- Active filters are recalled above the results and removable one by one.

Depends on: L3-01.

#### L3-03 Search state in the URL

As a reader, I want to send a link that replays my search exactly so that I can direct a colleague without explaining the steps.

- The query and active filters are encoded in the URL parameters.
- Opening the URL restores the query, the filters and the scroll position.
- The current URL is visible in the interface, which makes the state explicit.
- The browser's back navigation returns to the previous state.

Depends on: L3-02.

#### L3-04 Noteless words in the results

As a glossary owner, I want to see the gaps in my glossary while I search so that I fill them as I go.

- Recurring expressions without a note appear among the results, with a dotted outline.
- Their row states the number of occurrences and files.
- A "no note" facet isolates or excludes them.
- They are never ranked before an entity of equivalent relevance.

Depends on: L3-02, L2-04.

### L4 — Documents and twin resources

The most expensive batch in build time, delivered as plugins. Exit criterion: a second build on unchanged sources triggers no conversion, and the three files of a single workshop form a single page.

#### L4-01 Office conversion with cache

As a reader, I want to view a Word or PowerPoint document without downloading it so that I stay in the flow of my reading.

- The `convert-libreoffice` plugin converts docx, pptx and xlsx files to PDF through headless LibreOffice in the build image.
- The cache is addressed by the SHA-256 fingerprint of the source file: no unchanged file is reconverted.
- Conversion is parallelised across available cores, with no effect on output order.
- A conversion exceeding the timeout or the maximum size yields a `W-CONV-FAILED` finding; the document remains available for download.
- A PDF produced without extractable text on a large document yields a `W-CONV-SUSPECT` finding.
- The conversion cache lives in the pipeline cache, not in the published artefact.
- LibreOffice missing: the plugin disables itself with a finding and documents remain downloadable entities.

Depends on: L0-11.

#### L4-02 Resource metadata

As a reader, I want to know when a document was produced and by whom so that I can judge its freshness.

- The `reader-office` plugin extracts title, author, subject, keywords, dates, page and word counts from Office properties.
- For pptx: slide count and slide titles.
- For PDF: native metadata and page count.
- File dates are distinguished from the git commit date, both being kept.
- Extracted authors go through pseudonymisation when it is enabled.

Depends on: L0-11.

#### L4-03 Readable VTT transcripts

As a reader, I want to read a meeting transcript as text so that I find what was said without replaying the recording.

- The `reader-vtt` plugin parses VTT and SRT: duration, cue count, language, speakers.
- Rendered as HTML with timecodes in the margin, cues grouped by consecutive speaker.
- Timecodes are addressable anchors, hence shareable.
- Cue text is subject to term recognition like any other content.
- A passage from which a decision was extracted carries a reference to the produced note.

Depends on: L0-11.

#### L4-04 Transcript pseudonymisation

As the publication owner, I want participant names not to be published so that I stay within the regulations.

- Speaker names and detected personal mentions are replaced by pseudonyms that are stable from one build to the next.
- The role is kept instead of the pseudonym when the configuration asks for it (`keep_roles`).
- The mapping dictionary is never written into `dist/`; verified by a test that walks the published tree looking for real names.
- A personal mention detected outside the dictionary yields an `I-PII-DETECTED` finding for review.
- Pseudonymisation applies before indexing: no real name enters the search index.
- The default configuration does not enable transcript publication: it must be requested explicitly.

Depends on: L4-03.

#### L4-05 Twin resources of a single document

As a reader, I want a single page for a workshop that exists as a deck, as notes and as a transcript so that I do not believe there were three different meetings.

- Additive reconciliation score capped at 1: explicit frontmatter declaration (1.0), same base name in the same folder (0.7) or across sources (0.5), property title equal to the H1 (0.6), MinHash text similarity ≥ 0.8 (0.7) or ≥ 0.6 (0.4), added in the same commit (0.3).
- Above 0.9, resources are merged automatically into one entity with several representations.
- Between 0.5 and 0.9, a `W-DUP-CANDIDATE` finding is produced and the resources stay separate.
- The page shows representations as tabs and names the grouping criterion.
- A single entry in the search index and in the file tree, not one per file.

Depends on: L4-01, L4-02, L4-03.

#### L4-06 Viewer

As a reader, I want to leaf through a document in the page so that I can check a slide in three seconds.

- The `viewer-pdf` plugin renders the PDF through pdf.js, with page navigation, zoom and internal search.
- PNG thumbnails per slide for pptx, shown in a clickable rail.
- The original file remains downloadable.
- The viewer is loaded on demand, never in the page's initial bundle.
- Without JavaScript, a download link and the extracted text remain accessible.

Depends on: L4-01.

#### L4-07 Extracted text indexed

As a reader, I want a sentence said in a meeting to be findable through search so that the spoken corpus counts as much as the written one.

- Text is extracted from the converted PDF, not from the original format, so that there is a single extraction path.
- Extracted text feeds the search index, term recognition and similarity computation.
- The position in the document (page or slide) is kept so that the source can be cited.
- A document without a markdown representation yields a `W-DOC-NOMD` finding, usable as a work list.

Depends on: L4-01, L3-01.

### L5 — Interface contracts

Delivered as plugins. Without it an API note has nothing to show. Exit criterion: an API note displays its contract and its operations, and flags the operations that exist in the contract without a note.

#### L5-01 OpenAPI contract import

As an architect, I want my API operations to come from the contract so that I do not copy them by hand into a note that will go stale.

- The contract is declared through the `contract` attribute of the `api` note, as a URL or a file path.
- The `contract-openapi` plugin reads OpenAPI 3.x; one `endpoint` entity is produced per operation, carrying its method, path, summary and operation identifier.
- Confidence 0.95, method `contract_import`, provenance on the contract URL and the operation name.
- Referenced schemas yield candidate objects, offered without being linked automatically.
- The contract is cached by fingerprint; an unreachable contract yields a finding and does not stop the build.
- The contract version read is recorded and shown with its import date.

Depends on: L0-11, L1-09.

#### L5-02 WSDL contract import

As the architect of a legacy system, I want my SOAP services treated like the others so that the inventory does not stop at the modern perimeter.

- The `contract-wsdl` plugin reads the WSDL; one `endpoint` entity is produced per operation, carrying its name, port and binding.
- Same confidence and same provenance mechanism as for OpenAPI.
- Referenced XSD types yield candidate objects.
- An imported WSDL and an imported OpenAPI produce entities of the same shape: the rest of the chain does not know the difference.

Depends on: L5-01.

#### L5-03 Matching operations and notes

As an author, I want to write one note per operation and have it attach automatically to the contract so that I explain the business where it happens.

- Matching happens on the operation identifier declared in frontmatter, then on the method and path pair, then on the normalised title.
- A matched operation shows its note's markdown and its own declared properties.
- An operation note carries its own links: consumers, applied rules, handled objects.
- Links written in an operation's markdown are processed like anywhere else.
- An ambiguous match (two candidate notes) yields a `W-OPERATION-AMBIGUOUS` finding and no attachment.

Depends on: L5-01.

#### L5-04 Contract viewable in the page

As a consuming developer, I want to see the contract without leaving the note so that I check a signature while reading the business.

- A contract viewer embedded in the page renders the operations and schemas of an OpenAPI contract; the WSDL rendering occupies the same slot. The viewer is a purpose-built island of the default theme, shipped as its first UI component contribution and fed by a JSON fragment the build writes from the cached contract; Swagger UI is not embedded: it needs a network fetch and weighs more than the page budget.
- The contract is never copied into the markdown: the note displays it, it does not duplicate it.
- The contract viewer is loaded on demand.
- The original contract remains downloadable at its URL.
- No network call is made to the real API from the published site.

Depends on: L5-01, L5-02.

#### L5-05 Gaps between contract and notes

As an architect, I want to know what exists in the contract without being documented so that I can measure my documentation debt.

- An operation present in the contract without a note is listed and flagged in the page.
- An operation note with no match in the contract yields a `W-OPERATION-UNMATCHED` finding: either the operation disappeared or the note is ahead.
- An API declaring a consumer that does not cite it, or the reverse, yields a `W-API-CONSUMER-MISMATCH` finding.
- An API with no declared nor inferred consumer yields a `W-API-NOCONSUMER` finding.

Depends on: L5-03.

#### L5-06 Type-driven neighbour order

As a reader of an API note, I want to see the operations before the rest so that I work at the grain that matters to me.

- The profile declares, per entity type, the priority order of neighbour types in the panel.
- On an API, operations come first; on a screen, accessed objects; on a rule, what it applies to.
- Without a declaration, the order is decreasing confidence.
- Reordering is profile data, never a condition in the template code.

Depends on: L2-05, L5-03.

### L6 — Lint in continuous integration

The adoption mechanism: a team wires the component in two lines and its repository becomes usable before any site exists. Four families of checks only. Exit criterion: the linter and the build produce identical findings on an isolated repository.

#### L6-01 Shared check registry

As a developer, I want a single implementation of each check so that the linter and the build never diverge.

- Each check is a pure function taking the model and returning findings.
- Checks are registered in a registry, enabled, disabled and re-severitised through configuration (`checks:`).
- The registry package (`@concordance-wiki/checks`) is consumed identically by the build and by the linter.
- Each check carries its identifier, default severity, description and remediation.
- MVP checks, four families: links (`E-LINK-BROKEN`); identifiers and types (`E-ID-DUP`, `E-TYPE-CONFLICT`, `E-FM-INVALID`, `E-META-REL`, `E-ENCODING`); documents (`W-CONV-FAILED`, `W-CONV-SUSPECT`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`); vocabulary and filing (`W-TERM-UNDEFINED`, `W-TERM-UNUSED`, `W-DOMAIN-UNCLASSIFIED`, `W-APP-MISSING`, `W-STALE`, `I-REL-AMBIGUOUS`, `I-PII-DETECTED`); plus the contract checks (`W-API-NOCONSUMER`, `W-API-CONSUMER-MISMATCH`).
- Structural checks (orphans, dead ends, unreachable screens, test coverage, batch consistency) leave the MVP with the projections they depend on.

Depends on: L0-09.

#### L6-02 Local lint without network

As a note author, I want to check my repository before pushing so that I do not discover my errors in review.

- `concordance lint --scope repo` checks the current repository alone: frontmatter valid against the profile, resolvable type, resolved internal links, unique identifiers, consistent suffix, expected sections present, UTF-8 encoding.
- No network access in this mode, no write outside `--fix`.
- Startup under two seconds on a 5,000-file repository.
- The output is stable and sorted, so that two reports can be compared.
- `--source` states which source this is, so that its typing rules apply.

Depends on: L6-01.

#### L6-03 Global lint without rebuilding

As an author, I want to check my links to other repositories so that I do not break a reference I cannot see from where I am.

- `--scope global` downloads the latest published `model.json` and checks cross-source links, the relation matrix and glossary homonyms.
- The remote model is cached locally, with a configurable validity period.
- An unreachable remote model degrades the check to local mode and says so, without failing.
- No model rebuild is performed.

Depends on: L6-02, L2-01.

#### L6-04 Outputs usable by forges

As a reviewer, I want problems annotated in the merge request so that I do not read a pipeline log.

- Output formats: readable text, JSON, SARIF, JUnit.
- Each SARIF finding points to the file and line, for display in the diff margin.
- Exit codes: 0 when no finding is above the threshold, 1 otherwise, 2 on execution error.
- `--fail-on` sets the blocking severity, `error` by default.

Depends on: L6-02.

#### L6-05 Linter distribution

As a team, I want to wire the check in two lines so that adoption does not depend on a tooling project.

- Six forms delivered: `npx`-executable package, standalone binary, GitLab CI component, GitHub action, container image, pre-commit hook.
- Each form is documented by a complete, copyable example.
- The six forms run the same registry version and produce the same output on the same repository; verified in continuous integration.
- A `concordance-lint.yaml` in the repository overrides severities locally.
- The GitHub action lives in the organisation's `lint-action` repository; the GitLab component in a `concordance-wiki` group on GitLab.

Depends on: L6-04.

#### L6-06 Safe automatic fixes

As an author, I want the tool to fix what is mechanical so that I keep my attention for what requires judgement.

- `--fix` normalises frontmatter, adds the type deduced by the cascade, orders keys, and rewrites a link to a renamed file when the target is unique and certain.
- No inferred link is ever written into a source file.
- Each fix is announced before application, and `--dry-run` lists them without writing.
- An ambiguous fix is refused and reported as such.
- Fixes are idempotent: a second pass changes nothing.

Depends on: L6-02.

#### L6-07 Linter and build parity

As the quality owner, I want the local check to say the same thing as the pipeline so that nobody loses trust in the tool.

- A parity test runs the linter in local mode and the build on the same isolated repository, and compares the findings.
- Any divergence fails continuous integration.
- The test runs on the golden corpus and on the faulty corpus.

Depends on: L6-02, L2-01.

#### L6-08 One documentation page per check

As an author receiving a warning, I want to understand what is being asked so that I fix it without guessing.

- Each check identifier has its page under `docs/checks/`, with a before and after example.
- The linter output gives the URL of the page for the check concerned.
- A test verifies that no registered check lacks a page, and that no page references a non-existent check.

Depends on: L6-01.

### L7 — Neighbourhood mini-map

Deliberately modest: one hop, six nodes, all labelled. Exit criterion: no label overlaps another, and the map has a textual equivalent.

#### L7-01 Displayed neighbourhood computation

As a reader, I want to see the six closest entities so that I grasp the context at a glance.

- The neighbourhood is computed at one hop, sorted by decreasing confidence then by identifier.
- Six nodes at most; the number is configurable but capped.
- Typed entities and noteless words are both eligible, and visually distinguished.
- The neighbourhood is precomputed at build and served with the page, never computed in the browser.

Depends on: L1-10, L2-03.

#### L7-02 Readable rendering

As a reader, I want to read the name of every node so that the map teaches me something instead of decorating the page.

- Each node carries its label in plain text, never a hover as the only way to know it.
- Labels are positioned without overlap; verified by a rendering test on six-node cases.
- The type is carried by shape and glyph, not by colour alone.
- Links to noteless words are dashed.
- Beyond the node cap, the map is not shown: a pointer to the mentions panel replaces it.

Depends on: L7-01.

#### L7-03 Textual equivalent

As a screen reader user, I want the same information as the map so that I lose nothing.

- An equivalent structured list is present in the HTML, next to the map.
- Each entry names the entity, its type and the nature of the link.
- The list is indexed by search.
- The map is hidden from assistive technologies, the list being authoritative.

Depends on: L7-02, L2-09.

### L8 — Documentation, golden corpus and governance

Runs alongside L2 to L7. Gates publication, not the demonstration.

#### L8-01 Bilingual fictional golden corpus and project wiki

As a developer, I want a stable reference corpus so that I write tests that do not depend on real data.

- A reference corpus (`fixtures/corpora/realistic`, Concordance describing itself, `en` and `fr`) covering every implemented type, every inference method and every check.
- A second, deliberately faulty corpus (`fixtures/corpora/faulty`), one file per expected finding.
- The expected result (model and findings) is versioned under `expected/` and compared on every run.
- No real nor personal data in the corpora.
- The `demo-glossary` and `demo-specs` repositories (Concordance as the subject) pass the linter without a finding and serve as the multi-repository integration test, referenced by tag.
- A test verifies that the `en` and `fr` corpora produce the same model structure.

Depends on: L0-10.

#### L8-02 Note templates

As an author, I want a note template to copy so that I know what to write and where.

- One template per implemented type, under `docs/templates/`.
- Each template passes the linter without a finding.
- Templates are reachable from the site and from `concordance init`.
- A test verifies that each template yields the type expected by the cascade.

Depends on: L6-02.

#### L8-03 Operations documentation

As an integrator, I want to install the tool without asking for help so that I evaluate it in half a day.

- A getting-started guide leading to a published site in under thirty minutes on the golden corpus.
- A complete configuration reference, generated from the schema so that it never diverges.
- GitLab and GitHub pipeline examples, copyable.
- Orders of magnitude stated: first build duration, incremental build duration, index weight, site weight.
- A page explicitly says what the tool does not do.

Depends on: L2-02, L3-01.

#### L8-04 Governance and licence

As a contributor, I want to know how to take part so that I can propose an improvement without hitting an implicit process.

- Chosen licence, applied to every package, with the inventory of dependencies and their licences.
- Contribution guide, code of conduct, merge request template, release process.
- Vulnerability handling policy and contact point.
- Organisation site (`concordance-wiki.github.io`): a hand-written static home page, no generator, no functional content duplicated from the wiki.

Blocked until the licence is confirmed.

#### L8-05 Framing transcript publication

As the compliance owner, I want the publication of a site built from transcripts to be framed so that pseudonymisation is not mistaken for an authorisation.

- A framing note recalls that the technical mechanism does not replace a governance decision.
- The documentation sets out the obligations: informing participants, legal basis, retention period.
- The default configuration does not enable transcript publication: it must be requested explicitly.

Depends on: L4-04.

#### L8-06 Turnkey container image

As an integrator without Node.js on my machine or my pipeline, I want a turnkey container image so that I build and check my wiki in one command.

- The image `concordancewiki/concordance` is published on Docker Hub at every release, tagged by version and `latest`, built from a `Dockerfile` of the monorepo.
- It ships Node.js LTS, the `concordance` preset with every official plugin, LibreOffice headless and the fonts the conversion needs.
- The entry point is the `concordance` command: `docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build` builds the configuration repository mounted on `/wiki` and writes `dist/` into it; `lint`, `init` and `validate-config` work the same way.
- The conversion cache can be mounted (`-v cache:/wiki/.concordance-cache`) and survives from one run to the next.
- The image runs unprivileged, as a non-root user, and writes only under `/wiki/dist` and the cache.
- A GitHub Actions pipeline builds the image, runs `build` on the golden corpus inside the container, compares the result with the build outside the container, then publishes; a GitLab and a GitHub pipeline example using the image is in `docs/guides/pipelines.md`.
- The image size is measured at every build and announced in the release summary.

Depends on: L4-01, L8-03.

#### L8-07 Living project wiki fed by its own specifications

As a maintainer, I want the project wiki to be built from the tool's own glossary and specifications on every change so that the documentation of the tool is a corpus the tool checks, never a copy that drifts.

- `demo-glossary` carries a `term` note per public concept of the tool: every term of its vocabulary, every top-level key of `concordance.yaml`, every check family, with `aliases` and `broader` filled; the homonyms `source`, `link` and `index` are deliberate, two notes each with a `## Not to be confused with` section.
- `demo-specs` carries the real specifications: a `screen` note per page of the generated site with a `## Today` section, a `rule` note per check of `docs/checks/README.md` with `## Applies to`, a `process` note per chain (build pipeline, lint in a merge request, release, adding a language pack, onboarding a repository, publishing the wiki), a `decision` note per public design choice of the architecture guide, `api` notes for `model.json`, the plugin API and the model query contract, the `business_object` notes of the canonical model and the `role` notes.
- Parity is verified in continuous integration: `scripts/parity.mjs` reads the three demonstration checkouts from `DEMO_ROOT` (`..` by default; the pipeline clones them at `main`, depth 1) and fails when a check page has no rule note naming the check, when a slot that renders a page has no screen note, when an active type of the default profile has no note across the repositories (types inferred from the typing rules of `demo-wiki`), or when a top-level configuration key or a check family has no glossary term; the report lists the gaps. The demonstration repositories lint themselves on every push with `concordance lint --fail-on error`.
- `demo-wiki` builds the site of the three repositories on every push, every morning, on manual dispatch and on the `content-updated` dispatch the content repositories send after a green lint on `main`, and publishes it on GitHub Pages; the sources are read at `main`. Until the first release, the workflows build the command line from a checkout of this repository; the human steps (the Pages source, the dispatch token) are documented in the README of `demo-wiki`.
- The notes are written from the public documentation only; nothing internal to the project crosses into the public repositories.
- `fixtures/README.md` says how the frozen `realistic` corpus and the living demonstration repositories relate.
- A first loop is documented: the wiki built locally, real findings read from `build.log.json`, at least three of them fixed by writing or correcting notes, the counts before and after recorded in the changelog of `demo-wiki`.

Depends on: L6-01, L8-01, L8-03.

### L9 — Default theme

The look of the site for a corporate reader: a wiki, familiar in thirty seconds, whose right panel shows what the tool computed. Exit criterion: the entity page of the fixtures corpus renders the chrome at three widths, and the measured contrasts of both palettes are pinned by a test.

#### L9-01 Chrome of the default theme

As a reader of a corporate documentation, I want the site to look like a wiki I already know so that I find a page in thirty seconds and trust what the right panel tells me.

- Tokens of the default theme: one type family for the text, Instrument Sans, self-hosted under the assets of the site with its OFL licence and never fetched from a font host, and IBM Plex Mono reserved to file paths and identifiers; a warm light palette (`#EFEDE9` page, `#FFFFFF` surface, `#E3E0DA` rule, `#1F2124` text, `#3A3E44` secondary, `#676C74` labels, `#A8431C` accent for links and the current position only, `#FBE3D4` highlight, `#F7F6F3` soft surface) and a separate dark palette whose contrasts are measured on their own; radii from 4 to 14 px; the accent never carries a status or a decoration; `theme.yaml` stays the override point (colours, logo, fonts), the palette gaining the optional `label`, `soft` and `highlight` colours in `theme.schema.json`.
- Top bar: mark and site name, the search field "Search the documentation" showing the `/` shortcut, the links "Spaces" (the sources), "A–Z index" and "Recent", the light/dark toggle; no build statistic in the bar, the to-do link and its count living in the footer.
- Left column: the tree of the current space (the source of the page), an initials badge, the folders with their page counts, the current folder open, the current page marked by a rule and the bold weight, never by colour alone; a folder of more than forty pages lists a window around the current page and counts the others.
- Centre: the breadcrumb "Space › folder › page", the title, the line "type · changed N days ago · space", the note rendered section by section, then the footer "path/of/file.md — Something to correct? Edit this page", the edit link as before.
- Right panel in three stacked blocks, never tabs: "Properties" (the declared attributes, with the note "Declared at the top of the file."), "On this page" (the table of contents of the H2 sections), "Related pages (N)" with a type filter (checkboxes with counts, "19 of 35 pages", "Clear all"), each entry giving the title, the type, the passage count and an excerpt, prefixed "Cited ·" when a written link exists, "Show the N others", and the note "Ordered by number of passages, written and recognised alike. “Cited” marks a link present in the text."; then the line "See the neighbourhood map · N pages" that unfolds the map and its textual equivalent.
- The same page at three widths, mobile first: the base styles are the phone's, the media queries add the tablet and the desktop; the drawer and the condensed panel exist under the desktop width. Phone (under 768 px, `48rem`): the bar shows the mark, the site name and a menu button (a 48 px target) opening a full-screen drawer; the drawer is a `<details>`, so it works without JavaScript and over `file://`, and it shows ✕ and the site name in the bar, the search field first, "Spaces" with an initials badge and a page count per source, the tree of the current space unfolded to the current page, "A–Z index" and "Recent" at its foot and the mode switch after them; the breadcrumb keeps the last folder and the page only; the line under the title reads the type and the short date; the panel blocks are closed disclosure sections in the order Properties, On this page, Related pages (open by default with its entries), Neighbourhood map, their counts after their headings; targets of 48 px. Tablet (768 to 1179 px): the bar shows the menu button, the site name, a "Search" button unfolding the field under itself and the mode switch; the tree stays in the drawer; the panel stays beside the text, condensed: Properties shows the values only, Related pages three titles and "N others" behind a disclosure; the neighbourhood map moves to the foot of the page. Desktop (from 1180 px, `73.75rem`): three columns and the full panel, unchanged. Text never under 13 px; targets of 40 to 44 px on the desktop.
- Gallery: a state named `entity-page-corporate` on a rule note of the fixtures corpus, and the states `entity-page-phone`, `entity-page-drawer` (the drawer served open) and `entity-page-tablet` on the same page, the gallery rendering at one width; the accessibility checker passes on them (the drawer has an accessible name, the menu button a label) and the contrast checker too; a test pins the measured contrasts of both palettes (body text at least 11:1, secondary text 6:1, the lightest labels 4.5:1, nothing under 4.5:1).

Depends on: L2-02, L2-08, L2-10, L2-12, L2-15, L7-02.

#### L9-02 Home page

As a reader who arrives on the site, I want to type a word or pick a space so that I reach a page in thirty seconds, whether or not anyone has defined that word.

- The page opens on the question "What are you looking for?" and its explanation ("Type a word of the business. If it is used anywhere in the documentation, it has a page — even if nobody has defined it yet."), then the search field, drawn large; its live results appear under it as the reader types, in the flow of the page: one row per match with its title, the query marked in it, its type chip or "Used in N documents, never defined" for a keyword page, and its space; the "N matches" counter in the field; the keyboard help "↑ ↓ browse · Enter open", the arrow keys walking the rows and Enter opening the one in focus; and the link "See the N results" to the results page. The field works without JavaScript as a `GET` form submitting to the results page; the field of the top bar shows the same rows.
- "Most cited": the twelve most cited pages as chips.
- "Spaces — fed by your repositories": one row per source, most cited first, with an initials badge, its name, "N pages" (or "N documents" when its notes mostly stand for converted documents) and its freshness from the git history ("2 days ago"); the tree of the space folds behind its row; past five spaces, the others fold behind "N more spaces, less cited"; the note "The dates come from the history of the repositories, so they are always right." follows.
- "Recently changed": the eight latest pages, each with its space and its date relative to the build.
- The alert "A space has not moved for N days" for every dormant space, naming it and the threshold of `staleness`: "The alert threshold is set to 180 days in the configuration."
- The file tree, the letters and the to-do link of the former home stay reachable: the tree behind the rows of the spaces, the letters on the A–Z index page, the to-do link in the footer; the "Spaces" and "Recent" links of the top bar still land on the two headings.
- Gallery: a state named `home-corporate`; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L2-07, L3-01.

#### L9-03 Search results page

As a reader of a corporate documentation, I want the results of a search laid out like a catalogue, the filters on the left and readable excerpts on the right, so that I narrow two hundred documents to the page I need without leaving the page.

- The bar shows the query in the field with a ✕ that clears it, served hidden and shown by the search island while the field holds something; the shortcut hint yields to it. Left column: "Page type" and "Space" as checkbox groups with counts (the existing facets type and source, the keyword type drawn with a dashed box), the domain, the application and the no-note facet as secondary groups below, folded; under them the note "The counters are set when the site is published. Filtering happens in the browser, without a round trip."; the active filters as chips with ✕ above the results, next to "N results, most cited first"; the address of the search stays under them.
- A result: the type as a chip, the title, "cited in N pages" (the distinct pages whose links point at the entity), the summary (a first paragraph standing in for one cut at two hundred characters, at a word), then the line "Space · Also called: aliases · Broader term: …" when the note declares them, the broader term named by the title of its page when the reference resolves; among results of the same relevance the most cited comes first, a keyword page still after the entities, and the whole table without a query lists the most cited first. A noteless word shows a dashed chip, a dotted title and "Used in N documents, never defined in the glossary"; under the list, the note "Words used but not defined appear with the others, dotted. That is how you spot what the glossary lacks."
- No result: the empty state names the query, and when the query has words the closest form of the dictionary is proposed ("plafon" → "plafond, N occurrences" for a keyword page, "cited in N pages" for a note): the title or alias sharing the longest common prefix with the query over the search table, at least two characters, the shortest form among equals, computed in the island and linked to the search on that form under the same filters.
- The page keeps working without JavaScript (the field of the bar is a plain `GET` form to the results page, which the island fills from the address, the whole table under the facets for an empty query, as before) and over `file://`; the state stays in the URL, the ✕ rewriting the current entry at once.
- Gallery state `search-results-corporate` (two notes of the fixtures corpus, a noteless word among the results and the glossary space selected); the accessibility checker and the contrast checker pass on it; a test pins the column of the facets from 768 px and the 40 px targets of the boxes, the chips and the clear links.

Depends on: L9-01, L3-02, L3-03, L3-04.

#### L9-04 Keyword page

As a reader, I want the page of a word nobody defined to look like every other page so that I understand at once what is known of the word and what is missing.

- The breadcrumb "Space › Terms › word", the space being the glossary when there is one, else the space of the first passage, and the tree of that space on the left with the word at its place as the current page; the title dotted, the "no note" mark; the line "No definition · Used since <month year>", the month of the earliest git date among the citing files as the model carries it, "Used since" omitted when no date is known; the box "Nobody has written a definition, but N passages use this word. This page is built from those passages alone. If someone creates the note in the glossary, its text will take its place here and the rest of the page will not change." and the button "Propose a definition", the existing lead to the forge of the glossary.
- "The passages, in corpus order" with the summary sentence "N files.", grouped by file with the type chip, the title and the count; each passage with its timestamp (`12:04`, transcripts), its page (`p. 12`, converted documents) or its line, read from the fragment of the citing page, and the text with the word marked.
- Panel: "What we know" (Occurrences, Files, Spaces, then "No declared property: there is no file for this word."), "Maybe the same thing" (the similar expressions with their counts and the note "Expressions close in form and context. A lead, not a claim."), the accompanying words, "Related pages" with the note "Ordered by number of passages. None is “cited”: this word has no note to carry links.", then the neighbourhood map folded.
- Gallery state `keyword-page-corporate` on an expression of the fixtures corpus; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L2-04, L3-04.

#### L9-05 Meeting page

As a reader, I want a working session that exists as a note, a transcript and a deck to read as one page so that I find what was said and what was decided without opening three files.

- The tree of the space groups the notes of a meeting space by year and month with their counts when every note of the space is dated (a `date` attribute or a file name starting with `YYYY-MM-DD`), newest first, the year and the month of the page open; a space with an undated note keeps its folder tree. The breadcrumb reads "Space › March 2026 › title"; the title; the line "Meeting · 1 h 12 · Pseudonymised participants", the duration from the `duration` attribute of the note, else the timecode of the last cue of the transcript, the mention when `privacy.pseudonymize.enabled` is set, else the number of declared participants.
- The tabs "Transcript | Notes | Slides", one per representation and labelled by its kind (a `.vtt` or `.srt` transcript, the markdown notes, a converted deck or document), with the mention "Grouped automatically" when the twin-resource reconciliation merged the files; served as anchors to panels the stylesheet shows one at a time, so that they work without JavaScript and a browser without `:has()` shows the panels one under the other. The transcript as timestamped lines "12:04 Participant-1 — …", the speaker of every cue carried from the reader through the fragment and pseudonymised with it, each timecode an anchor at the position the mentions cite; the note "The names of the participants are replaced at publication by stable pseudonyms. The mapping is never published." under it when pseudonymisation applied.
- The callout "Decision taken here" linking the decisions the model ties to the meeting at either end of a link (the `decisions` reference of the note, a written link, or a decision whose note names the meeting); absent when nothing links them.
- Panel: "Properties" (Date, Duration, Space, "Files: 3 grouped" with, under the list, why the build grouped them, from the signals of the duplicates block of the model for the pairs naming the note, "same folder, same base name, same commit, high textual overlap", else the criterion recorded on the entity), "Related pages" with the note "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.", the neighbourhood map folded.
- Gallery state `meeting-page-corporate` on a working session of the fixtures corpus; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L4-05, L4-06, L4-07.
#### L9-06 API page

As a reader of an interface, I want its page to show its operations matched to the contract and the contract itself, so that I see what the API offers and what the notes have not caught up with, without reading a schema.

- The tree of the space lists the APIs with their operations as children: the endpoint notes under their API, in model order, whatever folder they are filed in; the H1, the line "API · changed N days ago · space", then the summary, the note at full column width.
- Section "Operations — Matched to the contract by operation name": a table with the method as a chip (POST/GET/DEL…), the path in the monospace family, the label (the title of the endpoint note, linked) and "N callers" (the notes citing the operation); then the gap rows in italics, "present in the contract, without a page" for an operation the import left without a note, and "described, absent from the contract — unknown path" for a note the contract does not declare, from the `W-OPERATION-UNMATCHED` findings and the `exposes` links of the model; the notes describing the operations cite the API, so that the operations stand among its related pages.
- Block "Interface contract — openapi 3.1 · file · imported N days ago", the format recorded by the import (`format` on the contract record: `openapi 3.1`, `wsdl 1.1`), with the contract viewer in the page (the existing island, its button placed in this block) and the note "No schema is copied into the text: the page shows the contract, it does not duplicate it."
- Panel: "Properties" limited to five keys (the highlighted properties first, then the declared ones, cut to five, with the note "Five keys, no more. The operations come from the contract, not from the header."), "Related pages" where the operations come first ("On an interface the operations rise to the top: that is the grain we work at."), the neighbourhood map folded.
- Gallery state `api-page-corporate` on the API of the fixtures corpus; the accessibility checker and the contrast checker pass on it; the contract viewer island keeps its tests.

Depends on: L9-01, L5-03, L5-04, L5-05.

#### L9-07 Neighbourhood map in the panel

As a reader who opened the line of the panel, I want the map to take the panel and nothing else so that I explore the neighbourhood of the page without losing its text.

- Opening "See the neighbourhood map" replaces the blocks of the panel by the map: the `<details>` of the fold drives it, its summary becoming the head of the map once open, a ◂ back control before the title "Neighbourhood map" and the name of the page, the other blocks hidden from the desktop width; the text stays readable and the map occupies the panel, never the page; without JavaScript the fold simply opens under the blocks.
- Controls: "Distance · 1 hop", the hops the model records (the displayed neighbourhood is computed at one hop; a second hop is never computed in the browser), and "Types ▾", a filter of checkboxes served all ticked that hides the nodes, the edges and the rows of an unticked type, from the stylesheet alone; the legend "existing page / word without a note", the noteless word drawn dotted.
- Six neighbours at most, always named, no label overlapping another, the layout test kept; the section "The six neighbours · textual equivalent" lists each neighbour with its type and its passage count; the note "Six neighbours at most, always named. Beyond that the map teaches nothing: the list takes over." closes the fold.
- On the phone the map keeps its fold in the flow of the page, on the tablet it sits at the foot of the page: only what is inside the fold changes.
- Gallery state `entity-page-map`, the corporate entity page with the fold open; the accessibility checker and the contrast checker pass on it, the SVG keeping its caption and the textual equivalent.

Depends on: L9-01, L7-01, L7-02, L7-03.

#### L9-09 A–Z index

As a glossary owner, I want the index to list every word the documentation uses, defined or not, with what is known of each, so that the words without a definition stand out as my working list without being set apart.

- The page is titled "A–Z index" and opens on the sentence "N words used in the documentation. N have a written page, the others exist through their uses alone." (the entities with a note against the keyword pages); beside it the folded button "Filters ▾", a `<details>` whose menu lists "By type" (the types of the notes with their counts), "By space" (the sources) and "without a definition", every value a link to the results page filtered by it (`search/?type=…`, `?source=…`, `?nonote=only`, which lists the whole site under its facets when it receives no query), so that the filters work without JavaScript.
- The letter bar A–Z then `#`, in the monospace family, the current letter on the ink, a letter without an entry kept in view, struck through and inert, and after the bar "N letters without an entry"; then, for every letter of the page, the heading "A — 94 words".
- The table under the heading, its column labels in small capitals: WORD · TYPE · FIRST LINE OF THE PAGE, OR MOST CITED PASSAGE · PAGES. The word links to its page; the type is its label from the profile; the first line is the summary of the note (its `summary` or its first paragraph, cut at a word before 200 characters); the pages column counts the distinct pages citing the word (the pages linking to a note, the files an expression is read in). A word without a definition sits among the others in the collation order, its title dotted, the label "no definition" dashed in the type column and, in place of a first line, the passage of the file that uses it most ("“…” — title of the file", the earliest passage of that file); the note under the table reads "Words without a definition sit in the index like the others, dotted, with the passage that uses them most in place of a definition. That is the working list of a glossary owner."
- The pagination per letter stays (the whole index as one page under 100 kB, one page per letter with entries past it, `index/index.html` showing the first); no JavaScript is needed anywhere on the page; the type glyphs of the former list are no longer shown, the table naming the type instead.
- Gallery: a state named `index-corporate` on the letter S of the fixtures corpus, two homonyms and a word without a definition among its rows; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L2-06, L3-04.

#### L9-10 Spaces pages

As a reader who picks a space rather than a word, I want the spaces to have pages of their own so that I change page instead of unfolding a tree from the home page.

- The page `spaces/index.html`: the title "Spaces", the sentence "N spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.", then one table with the columns SPACE (initials badge and name), CONTENT, PAGES and LAST UPDATE, every space listed in the order of the home page, the most cited first, none folded. CONTENT is the new optional configuration key `sources[].description`, one sentence, declared in the schema, the reference and the guide; without it the labels of the dominant types of the space stand in. A space past the staleness threshold shows its date in the accent colour, doubled by its value in days ("193 days ago"), the only place where a colour carries an alert. The note under the table reads "The dates come from the git history, so they are always exact. A space past the freshness threshold — 180 days by default — is marked in accent, the only case where colour carries an alert, doubled by the value in days.", the default of `staleness.warn_after_days` filled in.
- The page of a space, `<source name>/index.html`: the search field of the bar reads "Search in this space" and submits with the space set as the source facet, its live results keeping to the space; the breadcrumb "Spaces › name"; the initials badge, the title, the description of the configuration when there is one, the line "N pages · repository X · updated N days ago", the repository named from the URL the build recorded, else by the source name; "Browse — N categories, as filed in the repository": one card per top-level folder with its name, one sentence (the description of the type the folder maps to when one exists, else empty), its page count and an arrow, linking to the list of the category at `<source>/<folder>/` (story L9-11; when a note takes that address, the card links to the page the tree lists first under the folder, where the tree opens on it); the note "Each category opens its own list. The tree on the left appears only once in a page, so that nothing has to be unfolded from the home page."; no tree on the page.
- "Recently changed" lists the four latest pages of the space with their category and their date; "The most cited words here" offers the five pages the notes of the space cite most, a keyword page among them dashed, with the note "Counted in this space only, which gives its own vocabulary."; the right column closes on "A space reads like a small wiki within the wiki: its own search, its own vocabulary, its own news."
- The rows of the home page, the "Spaces" link of the bar, the "SPACES" entry of the drawer and the space of every breadcrumb lead to these pages; the rows of the home page fold no tree any more. Gallery states `spaces-corporate` and `space-corporate`; the accessibility checker and the contrast checker pass on them.

Depends on: L9-01, L9-02.

#### L9-11 Category list

As a reader who opened a space, I want the list of a category to open as a page so that I reach the screen, the rule or the object I am after from the folder that holds it, without unfolding a tree.

- The bar's search field reads "Search in <category name lowercased>" and submits with the space and, when the folder maps to a type, the type facet set, as hidden fields of the form; the left tree shows the space with its categories and their counts, the current category marked as a current page is; the breadcrumb reads "Spaces › Specifications › Screens".
- The title is the folder name, capitalised, then the sentence "N screens described." worded by the type followed by the description of the type from the profile: a type module and a profile type gain an optional `description` (one sentence saying what an entity of the type is) and a `counted` message (an ICU message with a `count` argument), English in the source and French in the module messages, one sentence per core type; when the folder maps to no type, or the type has no count message, "N pages." alone.
- The selectors "Roles ▾" (the first highlighted attribute of the type, its values as links filtering the list, "All" lifting the filter) and "A–Z ▾" (the sort, by title or by links, most related first); the table SCREEN (the title, linked) · ROLES (the values of the attribute, linked when they name a page) · FIRST LINE (the summary of the note) · LINKS (the number of related pages, the one-hop neighbours of the model); the line "8 screens of 64 — pagination by twenty." with the page links when the list has several pages; the note "The Links column counts the related pages, which brings the most central screens of the journey to the top."
- One page per top-level folder of each space at the folder's address (`<source>/<folder>/index.html`), unless a note takes that address; the sort and the attribute filter as links to pre-rendered variants under `<source>/<folder>/-/` when the sorts times the values give twelve pages at most, else an island that applies the choice in place, the served page reading by title without JavaScript, the selectors appearing once the island runs; the folders at the top of the space tree and the first folder of the breadcrumb of an entity page link to their lists; gallery state `category-corporate` on the screens of the fixtures corpus; the accessibility checker and the contrast checker pass on it.

Depends on: L9-10.

#### L9-12 Screen page

As a reader of a screen note, the most consulted type, I want its tables and its original sketch rendered as the author placed them so that the page reads like the file, with what the tool computed beside it.

- Tree: the screens folder unfolded on the neighbouring screens; the breadcrumb "Specifications › Screens › title"; the H1, the line "Screen · changed N days ago · space".
- The note section by section, on the same template as the rule page: a markdown table rendered as a card, its header row in uppercase small labels ("RULE · SEVERITY · EFFECT ON VALIDATION") on the soft surface, the first column in the ink and the other cells, the severity words among them, in the secondary colour as plain text; an image of the repository that stands on a line of its own shown in the flow as a figure with its caption (the alternative text) and, under it, "Image of the repository, shown in the flow of the text" and the path of the file in its repository in the monospace family, the note worded from the catalogue at render time so that the fragment stays neutral; an image among text or an external image kept as an `<img>`; the foot of the article carrying the legend "written link / recognised word" and the path of the file, with the edit link when the forge is known.
- Panel: "Properties" with the note "N declared keys. The rest of the file is free text.", "On this page", "Related pages" with the note "From the surest to the weakest: written links first, then recognised mentions." and the list ordered so, the pages that write a link first, then by number of passages, the corpus order breaking ties, then the neighbourhood map folded. The ordering and both notes are those of every entity page, since the panel is the same: the L9-01 note "Ordered by number of passages, written and recognised alike. “Cited” marks a link present in the text." and "Declared at the top of the file." are replaced by them.
- Gallery: a state named `screen-page-corporate` on the entity page screen of the fixtures corpus, which gains a table of the checks it applies and the sketch it was drawn from, an SVG of the page under `specs/assets/`, in both languages; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L2-15.

#### L9-13 Document page

As a reader, I want the page of a deck or a report to open on the document itself so that I check a slide in three seconds and still find the text, the notes and the original.

- The page of an office document (a deck, a report, a spreadsheet or a PDF, alone or merged with its note; a page with a transcript keeps the generic layout) is laid out as a document page: the tree of its space on the left, folded by year and month rather than by folder when every page of the space is dated, as the tree of a meeting space is, the newest year and the newest page first, the folder tree kept otherwise; the breadcrumb "Space › March 2026 › title"; the title; the line "Presentation · 24 pages · 4.2 MB · 12 March 2026" (the kind from the extension, the page count the conversion found, else the one the file states, the size, and the date read from the file's metadata when its reader gave one, else the git date), each datum omitted when the corpus has none.
- Three views behind the tabs "Document | Extracted text | Related notes", a tab bar of anchors that works without any script, the stylesheet showing the targeted view alone, the document until one is targeted; "Download the original" at the end of the bar, the original file placed next to the page as the previews are. The document view: the strip of pages "PAGES 01 … 24", numbered thumbnails leading to the text of the page, the first one current, then the rendering of the current page by the viewer, opened as soon as its script runs, with its toolbar "7 / 24 | − 100 % + | ⌕ in the document" (the counter, the zoom between its two signs, the find field over the extracted text that positions the current page), the strip following the page shown and driving the viewer; under it the notes "Converted at publication, cached by fingerprint" and "The original stays downloadable". The extracted text view: the text of every page in disclosure blocks anchored as the mentions cite them. The notes view: the note merged with the document, or the sentence saying that none describes it yet.
- Panel: "Properties" (Type, Author as the file states it, Pages, Date, with the note "Read from the file, distinct from the repository date." when the date comes from the file), "Same document, three files" (`.pptx` original · `.pdf` preview · `notes.md` session notes, with the note "Grouped by folder, date and textual overlap — a single entry in the index."), "Related pages", then the neighbourhood map folded behind its line.
- Without JavaScript: the first page rendered by the browser's own PDF viewer through an `<object>`, the extracted text and the notes reachable by their anchors, the original downloadable. The size of the original and the author, date and page count its reader exposed travel in the `documents` of the fragment; the model gains nothing else.
- Gallery state `document-page-corporate` on a deck of the fixtures corpus; the accessibility checker and the contrast checker pass on it.

Depends on: L9-01, L4-05, L4-06, L4-07.

## 5. Working conditions

### 5.1 Ready

A story enters development only when its upstream batch is delivered, its acceptance criteria are testable without interpretation, the golden corpus contains a case that exercises it, and its effect on build time or published weight is estimated when it has one.

### 5.2 Done

A story is done when the code is covered at 100% in lines and branches, the acceptance criteria are verified by tests named after them, the golden and faulty corpora pass, determinism is preserved, user documentation is up to date, a check page exists for every added check, and the quality gate is green.

### 5.3 Cross-cutting requirements, applicable from L0

| Requirement | Verification |
|---|---|
| Full coverage | blocking quality gate at 100% lines and branches; exclusions justified one by one in review; mutation testing ≥ 85% on `core`, `typing`, `nlp`, `inference`, `checks` |
| Determinism | double-build test comparing fingerprints, run on every merge request |
| No write into sources | test comparing the working tree fingerprint before and after the build |
| Accessibility | automated audit in CI, zero serious or critical violation; textual equivalent for every graphical view |
| No secret published | test walking `dist/` for the real names of the pseudonymisation dictionary and for secret patterns |
| Performance budget | build duration, index weight and site weight measured on every build and compared with the previous one |
| Linter and build parity | identical findings on an isolated repository; any divergence fails CI |
| External contributions | every blocking test runs on a merge request from a fork, without secrets or private repositories |

### 5.4 Risks and mitigations

| Risk | Mitigation |
|---|---|
| The first build exceeds the acceptable pipeline time because of office conversion. | Fingerprint cache from L4-01; parallelism; previews can be disabled per source; the order of magnitude is stated in the documentation. |
| The number of keyword pages explodes and makes the site unmanageable. | Publication threshold configured from L1-12, and a counter reported on every build. |
| Occurrence noise discredits the tool with the first users. | Strict exclusion of code and URLs (L1-04), homonym handling (L1-02), clear visual separation between written links and occurrences (L2-05). |
| The published weight exceeds the forge cap. | Previews kept out of the artefact beyond a threshold, conversion cache outside the publication, weight measured on every build. |
| Full coverage slows down the first batches. | Checks and inference written as pure functions, hence testable without fixtures; coverage follows. |
| Pseudonymisation is mistaken for an authorisation to publish. | Framing note in L8-05 and a default configuration that does not publish transcripts. |

## 6. MVP exit criteria

The MVP is deliverable when, on a real, unprepared corpus, the following five statements hold: the build is byte-reproducible for unchanged sources; every word above the threshold has a page reachable in three clicks from the home page; a page shows its rendered markdown before any metadata; mentions distinguish written links from recorded occurrences; and `concordance lint` fails in CI on a broken link.
