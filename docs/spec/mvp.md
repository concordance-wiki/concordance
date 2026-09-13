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
| Official plugins | `@concordance-wiki/plugin-reader-vtt`, `/plugin-reader-office`, `/plugin-convert-libreoffice`, `/plugin-contract-openapi`, `/plugin-contract-wsdl`, `/plugin-viewer-pdf`, `/plugin-viewer-swagger` |
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
| Contracts | `W-CONTRACT-UNREACHABLE`, `W-OPERATION-AMBIGUOUS`, `W-API-NOCONSUMER`, `W-API-CONSUMER-MISMATCH` |
| Plugins | `W-PLUGIN-DISABLED` |

## 4. Batches and stories

Sixty-nine stories in nine batches, ordered by dependency. L0 to L3 form the minimum demonstrable base; L4 to L7 are independent from each other and can run in parallel; L8 runs throughout.

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
- Client bundles are produced by esbuild, one per island, with hashed names, `modulepreload` and `defer`; two builds give byte-identical bundles.
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

- The `viewer-swagger` plugin embeds Swagger UI in the page for OpenAPI contracts; the WSDL rendering occupies the same slot.
- The contract is never copied into the markdown: the note displays it, it does not duplicate it.
- The contract viewer is loaded on demand.
- The original contract remains downloadable at its URL.
- No network call is made to the real API from the published site.

Depends on: L5-01, L5-02.

#### L5-05 Gaps between contract and notes

As an architect, I want to know what exists in the contract without being documented so that I can measure my documentation debt.

- An operation present in the contract without a note is listed and flagged in the page.
- An operation note with no match in the contract yields a finding: either the operation disappeared or the note is ahead.
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
