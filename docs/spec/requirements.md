# Target requirements

This page summarises the full target of Concordance, beyond the MVP. It exists so that no MVP decision blocks a later feature. The [MVP specification](mvp.md) says what is built first.

## 1. Vision

A project team accumulates functional knowledge in git repositories: meeting transcripts, specifications, framing notes, a glossary, reference data, standards, decisions, a test strategy, migration notes. That knowledge is written in standard markdown so that assistants can use it. Concordance turns it into a functional model of the system (actors, processes, screens, APIs, events, batches, business objects, rules, decisions) and makes it browsable, without ever constraining how the knowledge is written.

The model is computed, not entered. It is derived from the documents by declarative typing (repository, folder, suffix, frontmatter) and by link inference (markdown links, metadata, term occurrences, co-occurrences), each link carrying a confidence score according to the method that produced it.

### Measurable objectives

| Id | Objective | Indicator |
|---|---|---|
| O1 | No writing constraint: any existing markdown file is ingestible without modification | 100% of the `.md` files of a test repository ingested without error |
| O2 | The model is reproducible and versioned | two builds on the same commit produce an identical graph (fingerprint) |
| O3 | The generated site works without a server | functional over `file://` and from forge pages |
| O4 | Typing is entirely configurable | adding an entity type requires no code change |
| O5 | Every link is auditable | provenance (method, occurrences, source) shown for 100% of links |
| O6 | Usable as a white label | no label specific to any organisation in the code |
| O7 | Industrial quality | 100% coverage, blocking quality gate |

### Non-objectives

- Reading or analysing source code. An external source such as a code analysis tool may feed the model later.
- Editing notes online. Editing happens in git; the optional service proposes merge requests.
- Authentication and rights. The static site inherits the protection of its hosting.
- ArchiMate Strategy and Technology layers.
- Interface languages beyond English and French.

### Two tiers

| Tier | Nature | Required |
|---|---|---|
| Generator (`concordance build`) | CLI run in a pipeline: ingestion, typing, inference, checks, conversion, model export, static site | yes |
| Static site | HTML, CSS, JavaScript and JSON: navigation, client-side search, projections | yes |
| Service (`concordance serve`) | HTTP process and MCP server: assistant chat, link and note suggestions, merge request creation, model query API | no |

## 2. Personas and use cases

| Persona | Expectation |
|---|---|
| Manager, project lead | see the extent of the knowledge, search a term, understand a process in thirty seconds, show the result |
| Functional writer | know what to document and where the gaps are: words without a note, documents without markdown |
| Functional architect | end-to-end links, impacts, API contracts, structural views |
| Developer assisted by AI | agents get the context (MCP); specifications and glossary are linked |
| Integrator | install in half a day, simple configuration, white label |
| Open source contributor | readable code, tests, meta-model in configuration, clear governance |

| Id | Use case | Version |
|---|---|---|
| UC01 | Search a term and see its definition, aliases and occurrences | MVP |
| UC02 | Browse the navigation map of an application's screens | later |
| UC03 | View a process as BPMN with lanes per actor | later |
| UC04 | Analyse the impact of a change on a business object (lineage) | later |
| UC05 | See the screens × objects matrix (functional CRUD) | later |
| UC06 | Adjust the confidence threshold to explore implicit links | later |
| UC07 | Read the health report of the corpus | later; the lint in CI covers the MVP need |
| UC08 | Preview a Word, PowerPoint or VTT document without downloading it | MVP |
| UC09 | See the event choreography between applications | later |
| UC10 | See the batch calendar and dependencies | later |
| UC11 | See the lifecycle timeline of an object | later |
| UC12 | Accept or reject an inferred link (creates a merge request) | later, service |
| UC13 | Ask a question in natural language about the model | later, service |
| UC14 | Create a term note from a recurring unreferenced expression | later, service |
| UC15 | Query the model from an agent through MCP | later, service |
| UC16 | Compare two plateaus (before and after a migration) | later |

## 3. Product glossary

| Term | Definition |
|---|---|
| Source | A git repository (or a local folder) declared in the configuration, with its typing rules |
| Resource | An ingested file, markdown or not |
| Note | A markdown resource recognised as a typed entity of the model |
| Document | An untyped resource: a raw source of knowledge such as a transcript, a Word or PowerPoint file, a PDF |
| Representation | One physical form of a single logical resource: the original `.pptx`, the converted `.md`, the preview `.pdf` |
| Entity | A node of the model, instance of a type of the meta-model |
| Type | A category of entity defined in the profile |
| Relation | A typed, directed link between two entities |
| Link | An observed or inferred relation, with its provenance and score |
| Confidence | A value in [0, 1] expressing the reliability of the method that produced a link |
| Provenance | The evidence of a link: method, file, line, occurrences |
| Profile | The configuration file of the meta-model: types, attributes, relations, display |
| Domain | A global business grouping declared by globs across sources |
| Application | A first-level container: every entity belongs to an application |
| Projection | A computed view of the model |
| Check | A consistency rule evaluated on the model, producing findings |
| Finding | The result of a check on an entity or a link: info, warning, error |
| Lock | A versioned file recording human decisions: accepted and rejected links, merged and separated duplicates, rejected term candidates |
| Term candidate | A recurring multi-word expression not referenced in the glossary |
| Plateau | A dated state of the model, used for before and after comparisons |
| External source | A third-party system imported read-only, never synchronised back |
| Pseudonymisation | Stable replacement of personal names by pseudonyms at build |

## 4. Principles

Every design decision that contradicts a principle requires a recorded decision.

| Id | Principle |
|---|---|
| P1 | Standard markdown, nothing more. CommonMark, GFM, optional YAML frontmatter. Links are relative markdown links. No wikilink, no proprietary tag. Every file stays readable without the tool. |
| P2 | The repository is dumb, the tool is smart. The model is computed on every build; no state is written into knowledge repositories. |
| P3 | Convention by default, declaration when needed. Type cascade: source → folder → suffix → frontmatter; the most specific wins. |
| P4 | Everything is configuration. Types, relations, thresholds, stopwords, theme, checks, projections: nothing hard-coded. The engine only knows "type, attributes, relations, score". |
| P5 | Every link has a provenance and a score. No anonymous link. |
| P6 | Propose, never write. Inferences never modify a source repository; every promotion goes through a human merge request. |
| P7 | Static first. Every feature works without a server; the service is an extension. |
| P8 | Reproducible and deterministic. Same input, same output, order included. Identifiers derive from content, never random. |
| P9 | Graceful degradation. An unconvertible resource stays an entity with its metadata; an anomaly becomes a finding, not a crash. |
| P10 | White label by construction. No company, client, project or person name in the code, fixtures or labels. |
| P11 | Functional before technical. The model describes what the system does for its users; source code is not read. Technical contracts are imported, never copied. |
| P12 | The model serves humans and agents. Every view has a visual form and a structured form (JSON, MCP). |
| P13 | English throughout the public repositories; site labels are translated (`en`, `fr`). |
| P14 | Minimal core, plugins, preset. The core reads markdown and produces JSON; format readers, converters, contract importers and heavy projections are plugins; a "batteries included" preset enables them by default. |

## 5. Meta-model

The default profile, `packages/profile/default.yaml`, is inspired by a lightened ArchiMate 3.2. Slugs are English; labels are translated.

### 5.1 Types

| Group | Slug | Specific attributes |
|---|---|---|
| Container | `application` | `code`, `owner`, `status` (active, legacy, target), `plateau` |
| Container | `domain` | `parent` |
| Business | `actor` | `external` |
| Business | `role` | `actors[]` |
| Business | `process` | `execution` (human, service, mixed, scheduled), `triggers[]`, `steps[]` from the `## Steps` section |
| Business | `business_event` | `nature` (business, technical, temporal) |
| Business | `business_service` | — |
| Business | `business_object` | `attributes[]`, `lifecycle[]` |
| Business | `rule` | `severity`, `condition`, `applies_to[]` |
| Business | `term` | `aliases[]`, `broader`, `narrower[]`, `synonyms[]`, `definition` |
| Business | `representation` | `format`, `channel` |
| Application | `screen` | `roles[]`, `reads[]`, `writes[]`, `actions[]` (label, to, condition), `rules[]`, `url_pattern` |
| Application | `api` | `protocol` (rest, soap, graphql, grpc), `exposure` (apim, direct, internal), `contract`, `consumers[]`, `objects[]`, `version` |
| Application | `endpoint` | `method`, `path`, `api` (imported from the contract) |
| Application | `function` | `execution`, `triggers[]` |
| Application | `batch` | `schedule` (cron), `window`, `depends_on[]`, `reads[]`, `writes[]` |
| Application | `channel` | `technology`, `guarantee`, `owner` |
| Application | `message` | `schema` (AsyncAPI), `carries`, `objects[]` |
| Application | `application_event` | `channel` |
| Application | `data_object` | `business_object`, `fields[]`, `schema` |
| Motivation | `goal` | — |
| Motivation | `requirement` | `priority`, `origin` |
| Motivation | `constraint` | `origin` |
| Motivation | `principle` | — |
| Motivation | `decision` | `date`, `nature` (functional, technical), `status` (proposed, accepted, superseded), `affects[]`, `supersedes` |
| Motivation | `standard` | `applies_to_types[]`, `mandatory`, `version`; applies to types, not entities |
| Implementation | `work_package` | `start`, `end`, `deliverables[]` |
| Implementation | `backlog_item` | `ref`, `tool`, `status`, `work_package`, `affects[]`, `requirement`; read-only from the tracker, never synchronised back |
| Implementation | `milestone` | `date` |
| Implementation | `plateau` | `date`, `applications[]` |
| Implementation | `gap` | `from`, `to` |
| Quality | `test_strategy` | `applies_to[]`, `levels[]` |
| Quality | `test` | `level`, `automated`, `covers[]`, `ref` |
| Raw | `document` | `format`, `author`, `date`, `pages`, `duration`, `representations[]`, `preview_available` |
| Raw | `meeting` | `date`, `participants[]` (pseudonymised), `decisions[]` |

Common attributes: `id`, `type`, `title`, `aliases`, `application`, `domain`, `status` (draft, proposed, valid, obsolete), `tags`, `source` (name, path, commit, last_modified), `summary`, `superseded_by`, `type_origin`, `locale`.

### 5.2 Relations

| Slug | Pairs (examples) | Directed | Attributes |
|---|---|---|---|
| `composes` | application → screen, api, process, batch, channel | yes | — |
| `assigned_to` | role → process, screen; actor → role | yes | — |
| `realizes` | process → business_service; function → business_service | yes | — |
| `serves` | api → screen; endpoint → screen; screen → process | yes | — |
| `accesses` | screen, api, batch, function → business_object, data_object | yes | `mode` (read, write, create, delete) |
| `triggers` | business_event → process; screen → screen; milestone → work_package | yes | `condition`, `label` |
| `flows_to` | process → process; batch → batch | yes | `object` |
| `publishes`, `subscribes` | process, api, batch, function → channel | yes | `message` |
| `carries` | message → business_event; representation → business_object | yes | — |
| `constrains` | rule → screen, process, business_object, api; constraint → requirement | yes | — |
| `represents` | data_object → business_object; term → business_object | yes | — |
| `specializes` | term → term; business_object → business_object | yes | — |
| `affects` | decision → any | yes | — |
| `documents` | document, meeting → any | yes | — |
| `covers` | test → process, screen, api, rule, requirement | yes | `level` |
| `implements` | backlog_item → requirement, decision, screen, api | yes | — |
| `applies_to` | standard → type | yes | — |
| `supersedes` | any → same type | yes | `date` |
| `related` | universal fallback | no | cap 0.6 |

### 5.3 Confidence scale

| Method | Confidence | Provenance |
|---|---|---|
| `explicit_link` | 1.00 | file, line, link text |
| `lock_promoted` | 1.00 | author, date |
| `contract_import` | 0.95 | contract URL, operation |
| `frontmatter_ref` | 0.90 | attribute |
| `folder_zone` | 0.90 | path |
| `section_mention` | 0.70 | section, line |
| `glossary_occurrence` | 0.60 base, +0.05 per occurrence, cap 0.80; homonyms halved; recognised type prefix +0.10 | line, 80-character context |
| `cooccurrence` | 0.40 | paragraph |
| `embedding` | 0.25 | cosine score (service) |

Combination of several methods on the same triple: `1 − Π(1 − cᵢ)`, capped at 1. Multi-hop lineage: the product of the edge confidences.

## 6. Sources, configuration and ingestion

- One configuration file, `concordance.yaml`, in a dedicated configuration repository that also holds the profile override, the theme, the business stopwords, the lock file and, never published, the pseudonymisation dictionary. See the [configuration guide](../guides/configuration.md).
- Type cascade, increasing precedence: the source's `default_type`, the source's `type`, the source's `rules` in order, the note's frontmatter. The type origin is kept and shown.
- Domains and sources are orthogonal. Repositories are split by document kind; domains are declared globally by globs across sources, then overridable by frontmatter.
- Decisions have a single destination: whatever their origin (framing note, decision record, standard, transcript), a decision becomes a `decision` note linked to its source by `documents`.
- A markdown resource is a note when the cascade gives it a type other than `document` or `meeting`. Otherwise it is a document: indexed, reconciled with its representations, but it enters the graph only through `documents`.
- Non-markdown resources: metadata extraction, PDF preview through headless LibreOffice rendered by pdf.js, PNG thumbnails per slide, extracted text for search and duplicate detection, idempotent conversion cached by SHA-256.
- Twin resource reconciliation: an additive score capped at 1 (explicit frontmatter declaration 1.0; same base name in the same folder 0.7, across sources 0.5; property title equal to the H1 0.6; MinHash similarity ≥ 0.8 → 0.7, ≥ 0.6 → 0.4; added in the same commit 0.3). Above 0.9, automatic merge; between 0.5 and 0.9, a candidate awaiting a lock decision.
- Transcript pseudonymisation: speaker names and detected personal mentions replaced by stable pseudonyms; the dictionary is never published; `I-PII-DETECTED` flags mentions outside the dictionary. The mechanism does not replace a governance decision.
- Contract import: OpenAPI 3.x and WSDL produce one `endpoint` per operation at confidence 0.95; AsyncAPI later produces channels and messages.
- External read-only sources, later: issue trackers (`backlog_item`), test reports (`test` results), code analysis tools (code → api, data_object links).

## 7. Inference

- Directed term recognition: dictionary from titles and aliases, normalisation per locale, Aho-Corasick automaton, word boundaries, longest pattern wins, configurable type prefixes, code blocks and URLs excluded.
- Undirected discovery: 1 to 4-word n-grams, stopword filters, C-value × IDF scoring, thresholds of three occurrences and two documents, exclusion of the lock's `rejected_terms`.
- Lock file: `links.accepted` re-injected at 1.0 (`lock_promoted`), `links.rejected` removed on every build, `duplicates.merged` and `duplicates.separated`, `rejected_terms`. The service will generate lock changes as merge requests.
- Confidence propagation for multi-hop impact analysis: product of the edges; the interface will filter by depth and threshold.

## 8. Projections

Each projection is defined by an input sub-graph, a transformation, a visual output, a structured output (JSON, Mermaid, BPMN XML), interactions, and the confidence threshold applied. Planned: global graph, navigation map, BPMN derived from the `## Steps` section of a process, CRUD matrix, impact lineage, domains, glossary and term candidates, health report, event choreography, batch calendar, lifecycle timeline, test coverage, requirement traceability, plateau comparison.

The MVP ships the entity page, the keyword page, search, the one-hop mini-map and a to-do page.

## 9. Checks

Every check has an identifier, a default severity (overridable), a description, a condition and a suggested remediation. Findings feed the build log and, later, the health report. The [check pages](../checks/README.md) document the MVP checks. Planned beyond the MVP: `W-ORPHAN`, `W-DEADEND`, `W-UNREACHABLE`, `W-OBJ-NOACCESS`, `W-DATA-NOOBJ`, `W-PROC-HUMAN-NOSCREEN`, `W-PROC-SERVICE-NOAPI`, `W-PROC-NOTRIGGER`, `W-EVT-NOPUBLISHER`, `W-EVT-NOSUBSCRIBER`, `W-MSG-NOOBJ`, `W-BATCH-WINDOW`, `W-BATCH-CYCLE`, `W-RULE-UNAPPLIED`, `W-DECISION-NOEFFECT`, `W-OBSOLETE-REF`, `W-CONV-UNSUPPORTED`, `W-LOCK-ORPHAN`, `I-LOWCONF`, `W-RULE-UNTESTED`, `W-TEST-ORPHAN`, `W-ITEM-NOTARGET`, `W-DECISION-UNIMPLEMENTED`, `W-NORM-NOTARGET`.

### The linter

Checks do not wait for the global build: every knowledge repository runs them locally and in its own CI through a packaged linter. Distributions: `npx` package and standalone binary, GitLab CI component, GitHub action, container image, pre-commit hook; later an IDE extension through LSP. Modes: `--scope repo` (local, no network), `--scope global` (against the latest published `model.json`), `--fix` (safe fixes only), `--format text | json | sarif | junit`. Exit codes 0, 1, 2. Same registry as the build; parity verified by test.

## 10. Site

- Read before navigating: every page starts with the note content; views come after.
- Zero hidden state: filters, selected node, tab and trail are encoded in the URL.
- Progressive: notes and the index are readable without JavaScript; interactive views activate with it.
- Accessibility: AA contrasts, full keyboard navigation, visible focus, textual alternative for every diagram, no information carried by colour alone.
- Theme: `theme.yaml` provides the name, logo, favicon, accent, fonts, radius, default mode and footer; a project stylesheet can follow the tool's; the default theme is neutral.
- Performance targets: first page under one second on 4G; search under 100 ms client-side for 10,000 notes; full build under five minutes for 10,000 files excluding conversion.

## 11. Service, later

An HTTP API and an MCP server over the same `model.json`: model queries, link and note suggestions, natural-language questions, merge request creation through the forge API. The AI provider is configured server-side; no key ever reaches the browser. Nothing in the static site depends on it.

## 12. Quality

100% line and branch coverage on production code, measured with a blocking quality gate; exclusions are limited, listed and justified. Mutation testing on the pure packages. Test pyramid: unit (pure functions), integration (golden corpora with expected model and findings), UI components, end-to-end on the generated site, contract tests on the schemas, performance trend on a synthetic corpus. Determinism, no write into sources, accessibility and no published secret are tested on every merge request.

## 13. Security

No secret in the repositories or the site. The build has read-only access to sources. Contracts fetched by URL are cached and their version recorded. The pseudonymisation dictionary is never versioned in a public repository nor written into the output. Vulnerabilities are handled through the [security policy](../../SECURITY.md).

## 14. Open questions

- Final licence and intellectual property validation before publication.
- ArchiMate Open Exchange Format export (strict profile).
- Calibration of inference thresholds on a real, anonymised corpus.
- Client-side docx rendering in addition to the PDF.
- Retention of previous `dist/` outputs for trends.
- Backlog: pre-ticket requirement notes in markdown, read-only tracker import, or both.
- Regulatory framing of publishing pseudonymised transcripts.
- Whether standards and test strategies enter the published graph or stay a separate corpus for agents.
