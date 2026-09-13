# Architecture

This page states the decisions that shape Concordance. Each one is a constraint on any change; a change that needs to break one starts with a discussion.

## Standard markdown only

Concordance reads CommonMark, GFM (tables, task lists) and optional YAML frontmatter. Links are relative markdown links. There is no wikilink, no proprietary tag, no directive. Every file in a knowledge repository stays fully readable without the tool. Structured information goes through frontmatter, section headings and lists, never through new syntax.

## Static generation in a pipeline

`concordance build` is a pipeline command that produces `dist/` and `model.json`. The site is static: the main content of every page is in the served HTML, JavaScript is progressive, and the site works over `file://`. Fragments that load on demand (mentions beyond the first twenty, search) are JSON files generated at build. An optional HTTP and MCP service will consume the same `model.json` later; nothing in the site depends on it.

## Rendering: slots, islands, layers

Pages are rendered at build by Preact components through `preact-render-to-string`; the published HTML carries the full content of every page. The site is a set of named slots (`Shell`, `Header`, `Footer`, `Home`, `EntityPage`, `KeywordPage`, `MentionsPanel`, `Neighbourhood`, `SearchResults`, `Index`, `Todo`), each with a typed view model that is the contract between the generator and a theme. The default theme implements every slot; a plugin's `theme` contribution replaces any of them with a component receiving the same props, and the slots it does not provide stay default.

Only interactive components are hydrated: an island is served as its static markup wrapped in a `<concordance-island>` element carrying its props, and a small hydration entry mounts the same component on it. esbuild bundles one minified module per island, named after a hash of its content, loaded with `modulepreload` and a deferred module script only by the pages that use it; a page without an island loads no framework JavaScript, and two builds give byte-identical bundles. Without JavaScript the content stays reachable: the mentions beyond the inline threshold sit in a `<details>` element until the island takes over.

Styling is native CSS in four cascade layers, `tokens, base, components, project`: custom properties generated from `theme.yaml` (colours of both modes, fonts, radius, spacing), the document defaults, one block per slot, then the project's own stylesheet, which wins every cascade by construction. `color-scheme` follows the system preference and a remembered mode, `prefers-reduced-motion` is honoured, and properties are logical so that a right-to-left locale needs no second stylesheet. A budget is measured on every build: 150 kB per page excluding previews, and the size of each island bundle appears in the build summary. See the [theming guide](theming.md).

Accessibility is checked at three levels, none of which needs a browser. The palette is checked as numbers: every text and background pair the stylesheet draws must reach 4.5:1 for body text and 3:1 for headings and the focus ring, computed from the WCAG relative luminance, and a project palette under the minimum is reported as a warning of the build. The markup is checked statically on every rendered page: one `h1`, headings in order, landmarks, labels, unique ids, a skip link first, and the ARIA patterns of toggles, `details`, tabs and icon-only controls. The rendered pages are audited by axe-core in the test suite, in a DOM without layout, failing on any serious or critical violation. Every graphical view ships its textual equivalent in the served HTML, the neighbourhood map next to its list of neighbours, so that the search index and assistive technologies read the same information.

## Declarative profile, generic engine

The meta-model is a YAML profile validated by a schema: types, attributes, relations with their allowed pairs, mapped sections, confidence scale, display rules. The engine only knows "type, attributes, relations, score". Adding a type, an attribute or a relation pair is a profile change, never a code change, and a test enforces it. Relation labels shown in the site come from the profile.

## Confidence and provenance on every link

Every link carries a confidence in [0, 1] and at least one provenance (method, file, line, context). When several methods produce the same source-target-relation triple, the confidence becomes `1 − Π(1 − cᵢ)`, capped at 1, and every provenance is kept. The scale per method lives in the profile. In the first version the score orders mentions and decides what is displayed; it is stored, not shown.

### Combining confidences

Every producer (explicit links, frontmatter references, section mentions, glossary occurrences, co-occurrence) emits its own links; a combination step then folds them into one link per source, target, relation and attributes, so that a `reads` and a `writes` link between the same notes stay apart. Within a group, every provenance is a method whose confidence is the probability that it is right on its own, and the group keeps the probability that at least one of them is: `1 − Π(1 − cᵢ)`, which two methods at 0.90 and 0.60 bring to 0.96 and three at 1.00, 0.70 and 0.40 to 1. The glossary occurrences of a group are the same term mentioned again and again rather than independent methods: they count as one method whose confidence starts at the base of the first and gains `confidence.glossary_occurrence.per_occurrence` (0.05) per additional occurrence up to `cap` (0.80), so a term found once is at 0.60 and five times at 0.80. Confidences are rounded to four decimals because `model.json` serialises them and a build must not differ by a floating-point tail.

Every provenance of the group is kept in canonical order (method, path, line, section); only an exact duplicate, the same method at the same path, line and section, is listed once. The function is pure and idempotent: combining an already combined model changes nothing, and the output does not depend on the order the producers ran in.

### Relation typing

Producers name what they know: a mapped section and a typed frontmatter attribute carry a relation, a markdown link, a plain mention and a co-occurrence only say `related`. Once every producer has spoken and their links are combined, one step names every relation from the profile, on four rungs: mapped section, typed frontmatter attribute, type pair admitting a single relation, `related`. The first two stand as produced; the step only checks that the profile allows the relation between the two types and drops the link with `E-META-REL` otherwise (a relation the profile does not declare at all is dropped the same way). A `related` link whose ordered type pair admits exactly one relation besides the wildcards takes it and records `relation_origin: pair` in its attributes; when only the reverse pair admits one, the link is turned around, so that a screen linking to a rule ends up constrained by it. A pair whose two types admit none or several relations leaves the link `related`, capped at `relations.related.cap` (0.60) after the combination, so that many weak methods never outweigh one declaration, and each such link yields one `I-REL-AMBIGUOUS` finding located on the file and line of its first provenance that names a file. This finding is reported by the step rather than computed from the model, because only the step knows the provenance behind the link and because a finding both computed and reported would be listed twice.

Links that now say the same thing are combined again: a pair-named link joins a declared link of the same source, target, relation and attributes, contributes its provenances and loses its marker, since the relation is then declared; it stays apart from a declared link whose attributes say more (a plain mention cannot tell `read` from `write`). Undirected relations go from the smaller identifier so that the two readings of one pair merge. A link with an endpoint the entity list does not type, such as a non-markdown resource, is kept as produced. The step is pure and idempotent, and its outputs are sorted.

Relation labels never live in the code: `relationLabel(profile, relation, locale, { inverse })` reads `label` or `inverse_label` from the profile, falling back from a regional locale to its language and then to English, and a test walks every relation of the default profile.

## Preview through PDF conversion at build

Office documents are converted to PDF by headless LibreOffice, rendered by pdf.js, with PNG thumbnails per slide. The cache is addressed by the SHA-256 of the source file and lives in the pipeline cache, not in the published artefact. Text is extracted from the converted PDF, the single extraction path. An unconvertible document stays an entity with its metadata, a download link and a finding.

## Lock file for human decisions

`concordance.lock.yaml`, in the configuration repository, records accepted and rejected links, merged and separated duplicates, and rejected term candidates. The first version reads `rejected_terms` only; the other keys are accepted by the schema and ignored with a warning, except that the [twin resources](#twin-resources) reconciliation applies the `merged` and `separated` pairs it is given. Nothing is ever written into a knowledge repository.

## TypeScript monorepo

Strict TypeScript, ESM, Node LTS from `.nvmrc`, pnpm workspaces, packages published under `@concordance-wiki/*`, versions and changelog through Changesets.

## No database

The graph is built in memory and serialised to `model.json`, canonically sorted and schema-validated. `concordance render` reads it without touching the sources. A Cypher export is provided for those who want the graph elsewhere.

## Canonical model

`dist/model.json` is the single file that describes the whole model; every later step reads it and none re-reads the sources. It is described by [`model.schema.json`](../../packages/core/schemas/model.schema.json), published with `@concordance-wiki/core`, and holds five blocks plus one optional:

| Block | Content |
|---|---|
| `build` | the only dated block: `tool` (version of the command line), `at` (timestamp from the injected clock), `profile_hash` (fingerprint of the merged profile) and `sources`, one entry per source with its `name` and, for a git repository, its `commit` and `url` |
| `entities` | one object per note: `id`, `type`, `title`, `locale`, `application` and `domain` when known, `type_origin`, `attributes` (the frontmatter keys that are not common attributes) and `source` with the `name`, `path` and `line` of the note, plus `aliases`, `status`, `summary` and `graph` |
| `links` | one object per source-target-relation triple: `from`, `to`, `relation`, `attributes`, the combined `confidence` and `provenance`, the complete list of what every method recorded |
| `findings` | the same array as `build.log.json` |
| `candidates` | `terms` (recurring expressions without a note) and `duplicates` (resources that look alike); empty until the corresponding steps exist |
| `neighbours` | optional: the K best co-occurrence neighbours per entity |

`assembleModel` in core puts every block in canonical order (sources by name, entities by identifier, links by triple, provenances by method, path and line, findings by check, source, path, line and message, candidates by score) and `serializeModel` writes it as canonical JSON: keys sorted at every depth, two-space indentation, a trailing newline. `parseModel` reads a model back and refuses anything the schema does not describe, with the same error wording as the configuration validator: parsing a serialised model gives back the assembled one.

`concordance export --format cypher` turns the model into a Cypher script (`toCypher` in core): a header comment with the tool version and the timestamp, then one `MERGE (n:Entity {id})` per entity with `SET` of its scalar properties (`type`, `title`, `locale`, `application`, `domain`, `type_origin`, and every scalar or list-of-scalars attribute as `attr_<key>`), then one `MERGE (a)-[r:RELATION]->(b)` per link with `r.confidence` and `r.methods`, the distinct provenance methods. The relationship type is the relation slug in upper case. Strings are quoted with backslashes and single quotes escaped; nested attribute values have no property form and are left out. The script follows the order of the model, so two exports of one model are identical.

## Reproducible builds

Two builds of the same sources write the same bytes. Every list is sorted canonically before it is written: findings by check, source, path, line and message; entities by identifier; links by the source, target and relation triple; provenances by method, path and line (`compareFindings`, `compareLinks`, `compareProvenances` and `sortCanonically` in `@concordance-wiki/core`). A step that runs in parallel sorts its results before writing them, so that scheduling never shows in the outputs. Nothing random is ever written, and the only timestamp is the `at` field of the build log, which is also the `at` of the `build` block of `model.json`. It comes from the injected `Clock`; when `SOURCE_DATE_EPOCH` is set, the command line pins that clock to the given instant, following the reproducible-builds convention, and two builds are byte-identical. A double-build test and a continuous-integration step compare every file of two builds of the golden corpus.

## Deterministic identifiers

An entity's identifier is `<source>/<relative path without extension or type suffix>`, slugified segment by segment: lowercase, accents removed, every other run of characters replaced by one hyphen. The longest type suffix declared by the source's rules is stripped, otherwise the extension; an undeclared suffix stays in the slug as a hyphen. A frontmatter `id` takes precedence when it follows the identifier pattern of the model schema; otherwise it yields `E-ID-INVALID` and the path applies. Never a UUID, never anything that depends on processing order. Duplicates yield `E-ID-DUP`; the first in `(source, path)` order is kept. The identifier is the page URL: the page of an entity is written at `<id>/index.html`, so that `<id>/` resolves on a hosted site as well as from `file://`.

## Findings, not failures

A content anomaly becomes a finding: identifier, severity, file, line, message, remediation. Findings go to `dist/build.log.json` and `model.json`. The build fails only according to `build.fail_on`. Every check is a pure function `(model) → findings[]` in a registry shared by the build and the linter; a test enforces parity.

## Linter and build parity

The local lint and the build never disagree on what they both compute. The linter in `--scope repo` reads one repository file by file and produces the findings of `LOCAL_CHECKS` (`@concordance-wiki/lint`): `E-ENCODING`, `E-FM-INVALID`, `E-ID-DUP`, `E-ID-INVALID` and `E-LINK-BROKEN`. It does so with the same functions as the build: `readMarkdown` and `resolveLink` from the ingest package, `identifierFor` and `resolveDuplicates` from core, the catalogue of the checks package for severities and remediations. A finding of those checks is therefore the same object on both sides, entity and wording included; the only thing the local scope leaves aside is a link that climbs above the repository, which may land in another source that only the build can see. The build adds the findings of the steps that need the whole model: typing, filing, cross-source links, vocabulary.

A parity test (`packages/cli/test/parity.test.ts`) holds the guarantee. For each fixture corpus, golden and faulty, it copies the corpus to a temporary folder, lints every source of the copy with the corpus configuration, builds the same copy with the clock pinned, and compares the two lists of findings restricted to `LOCAL_CHECKS` on `(check, source, path, line, entity)`, then field by field. Any divergence fails the test, and the test is part of `pnpm test`, so it fails continuous integration. The JSON report of the linter carries `scope` and `checks` so that a forge report states which checks the parity covers.

## Bounded neighbourhood

Co-occurrence is accumulated per paragraph, never as a full matrix. Only the K best neighbours of each node are kept (50 by default, `inference.neighbours.k`), ranked by count then by identifier.

Two entities named in the same paragraph (same source, file and line) are neighbours once, however many times each is mentioned there; their count is the number of such paragraphs. Each node keeps its own row of counts; a row is trimmed to its best K by count then by identifier whenever it grows past 2K, so memory is proportional to the number of nodes times K, never to the square of the number of nodes. A neighbour dropped by a trim starts again from zero if it reappears: a count is never overestimated, and the K retained are the true best K as soon as the frequent pairs stand out from the occasional ones, which is what a bounded neighbourhood is for. Paragraphs are visited in `(source, path, line)` order, so the result depends on the set of occurrences alone. A paragraph naming more than 200 distinct entities is a list or a table rather than prose: only its first 200 identifiers are paired.

Each pair gives one undirected `related` link at the `cooccurrence` confidence, emitted once from the lower identifier, with the number of shared paragraphs as the `count` of its single provenance; the relation typing step may refine `related` from the type pair. The `neighbours` block of `model.json` lists, per identifier and in identifier order, the retained neighbours best first, for the mini-map and the accompanying-words panel.

## Displayed neighbourhood

The mini-map of a page shows the one-hop neighbours of its entity, precomputed at build from the links of the model and served with the page: the browser computes nothing. Both ends of every link are neighbours of each other, whatever the direction of the link; a typed entity and a noteless keyword page are equally eligible, and each neighbour carries its `kind` (`entity` or `keyword`) so that the rendering can distinguish them. A neighbour reached through several links keeps the largest confidence and the relation of the most confident link, the first in code-unit order on a tie, and its `direction` is `out`, `in` or `both`, seen from the page. Neighbours are sorted by decreasing confidence then by identifier and truncated to `site.neighbourhood.size` (6 by default); the computation never shows more than 12 whatever the value, and the configuration schema rejects a larger one. The merge is commutative, so the result depends on the set of links alone. The `displayed_neighbourhood` block of `model.json` lists, per identifier and in identifier order, every entity with its neighbours best first, an empty list for one that has none. The type-driven neighbour order of the profile (`display.neighbours_order`) reorders this list at rendering time and is not applied here.

## Twin resources

A workshop exists as a deck, as notes and as a transcript; the reader must see one page. The reconciliation scores every pair of resources by adding independent signals, capped at 1: an explicit frontmatter declaration (1.0), the same base name in the same folder (0.7) or elsewhere (0.5), close base names at Jaro-Winkler 0.9 or more (those weights times 0.8), the property title of one equal to the heading of the other (0.6), similar text (0.7 from a Jaccard index of 0.8, 0.4 from 0.6), the same commit (0.3) and the folder proximity, the depth of the common prefix over the deeper folder, up to 0.2. Above 0.9 the resources merge into one entity carrying every representation and the criterion that grouped them, for the page to name; from 0.5 they stay separate with a `W-DUP-CANDIDATE` finding that lists every signal. The commit and the folder never create a pair on their own: an initial import puts every file in one commit.

Text similarity works on extracted text, never on binary content. Each text goes to its comparison form (the language pack normalises, cuts words and drops stopwords), then to 5-word shingles, then to a MinHash signature of 128 functions under a fixed seed. LSH banding, four rows per band, enumerates the candidate pairs: two signatures that share no band are never compared, so the full matrix is never built. In `auto` mode the pairs estimated at 0.5 or more have their exact Jaccard index recomputed on the full shingle sets, and the finding gives the share of lines in common. A pair whose word counts differ by more than half is an inclusion rather than a duplicate: its content signal is capped at 0.4 and the finding says so. The lock file wins over the score: `merged` pairs merge, `separated` pairs neither merge nor report. Resources are sorted by identifier before anything else and every output is sorted, so two runs, or a shuffled input, give the same result.

## Keyword page threshold

A keyword page exists from three occurrences in at least two files (`inference.keyword_pages`). Below the threshold the word is searchable but has no page. The build summary reports pages generated and expressions discarded.

## Paginated mentions

The first twenty mentions are in the served HTML; the rest loads from a JSON fragment per entity. Never a global index. A page weighs under 150 KB excluding previews.

## Core, plugins, preset

The core packages read markdown and produce JSON. They depend on no office format and no system tool. Format readers, the LibreOffice converter, contract importers, viewers and heavy projections are plugins under `@concordance-wiki/plugin-*`, declared in `concordance.yaml` under `plugins:`, contributing through a versioned plugin API (reader, converter, source, inference method, check, projection, UI component). A plugin whose system dependency is missing disables itself with a finding. The unscoped `concordance` package is the preset that enables the core and every official plugin; it is what the documentation installs.

## Locale per source

Each source declares a BCP 47 locale, defaulting to the project locale. A language is described by data, never by code: a folder holding `pack.yaml` (name, apostrophes, collation options, plural suffix rules, validated by `language-pack.schema.json`) and `stopwords.txt`. The engine ships `en` and `fr`; a regional variant (`fr-CA`) uses the pack of its language until a plugin registers a more specific one; other languages are packs shipped by plugins and registered at load. Type prefixes stay in the profile, per locale, so that a project can extend them without touching the pack. Word segmentation and collation come from the platform's Unicode implementation (`Intl.Segmenter`, `Intl.Collator`).

## Languages of the interface

Every label of the generated site goes through a message catalogue per locale in ICU MessageFormat (plurals, selections, numbers and dates expressed in the message itself), stored as JSON in the format translation platforms exchange. Message identifiers are typed from the source catalogue, so a missing key or variable fails the build; a test checks that every locale carries every key. Messages are resolved at build: the published HTML contains final strings and no localisation library runs in the browser. Dates and numbers use the platform formatters. A project overrides any message through `theme.yaml`.

## Search

The index is generated at build by Pagefind, fragmented by prefix and loaded on demand. Facets are metadata with counts frozen at build. No typo tolerance beyond the prefix, no semantic search: those belong to the service.

## Diagrams

Static diagrams are rendered at build (Mermaid to SVG). Later, BPMN and the global graph render client-side, loaded on demand. Every graphical view has a textual equivalent in the HTML.
