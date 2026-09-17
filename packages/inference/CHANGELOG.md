# @concordance-wiki/inference

## 0.4.0

### Patch Changes

- 2f298b0: The union-find of the duplicate resolution finds the root of a component by a loop with path compression, so that thousands of resources merged in a chain cost no stack; the PDF reader takes the last Info object when an update rewrote it under the same number; the OpenAPI reader follows a path item given as a local `$ref` and lists under `unresolvedPaths` those it cannot follow, instead of dropping the path in silence.
- 594a75f: Two mentions of one term in one paragraph are two provenances of the link, both kept and both counted, instead of one: the combination of links tells provenances apart by their position in the paragraph, not by their line alone, so that every passage reaches the mentions panel and the confidence grows with the mentions as documented.
- 7953b7d: A path segment with no letter or digit left (a name in another script, an emoji) is named after a stable hash instead of an empty slug that made the identifier invalid; the candidates of an ambiguous frontmatter reference are named in identifier order whatever the order of the entities; two cues of a transcript starting at the same instant get distinct anchors (`t-12000`, `t-12000-2`), so that every cue stays addressable.
- 4833f68: `yaml` is pinned to 2.8.3 and `ajv` to 8.18.0, the versions that close the two moderate advisories `pnpm audit` reported (a stack overflow on a nested sequence of a few kilobytes, which the frontmatter of any note could carry; a ReDoS on `$data` references, unused here).
- Updated dependencies [e5ca327]
- Updated dependencies [524f45d]
- Updated dependencies [b6a5530]
- Updated dependencies [da662fd]
- Updated dependencies [8b2155e]
- Updated dependencies [6d7208b]
- Updated dependencies [7e5a9b1]
- Updated dependencies [1f66f9f]
- Updated dependencies [4234308]
- Updated dependencies [a5ca382]
- Updated dependencies [5e137bf]
- Updated dependencies [a470bd4]
- Updated dependencies [ab7dd44]
- Updated dependencies [78f7248]
- Updated dependencies [30da51f]
- Updated dependencies [7359a7b]
- Updated dependencies [ccbf0fc]
- Updated dependencies [23d6f77]
- Updated dependencies [7953b7d]
- Updated dependencies [21ea529]
- Updated dependencies [ee74348]
- Updated dependencies [4833f68]
  - @concordance-wiki/core@0.4.0
  - @concordance-wiki/ingest@0.4.0
  - @concordance-wiki/profile@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [6a4fcf6]
  - @concordance-wiki/core@0.3.1
  - @concordance-wiki/ingest@0.3.1
  - @concordance-wiki/profile@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [7c56d0a]
- Updated dependencies [f8aad74]
  - @concordance-wiki/core@0.3.0
  - @concordance-wiki/ingest@0.3.0
  - @concordance-wiki/profile@0.3.0

## 0.2.0

### Minor Changes

- 90cdb13: `inference.domains.max_neighbours`: the degree above which a term is a hub of the corpus rather than a domain and never a pivot. Without it the most cited words of a corpus win every tie and every proposal names them. A proposal now names the pivot's own domain when something files the pivot, so that an unclassified note joins the domain of the terms it is close to; a domain named after the pivot only when the pivot itself is unclassified.
- 678b2f8: Emergent domains proposed from the neighbourhood: `inference.domains` names the terms with enough neighbours as pivots and reports every unclassified note within the radius as `I-DOMAIN-SUGGESTED`, listed in the build log, assigned only under `assign`; the lock file promotes a proposal under `domains`, and every entity records the origin of its domain under `domain_origin`.

### Patch Changes

- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [0adb9b5]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
  - @concordance-wiki/core@0.2.0
  - @concordance-wiki/ingest@0.2.0
  - @concordance-wiki/profile@0.2.0

## 0.1.0

### Minor Changes

- d910b38: Bounded neighbourhood: `accumulateCooccurrences` counts, per paragraph, the entities named together and keeps for every node its K best neighbours by count then by identifier (`inference.neighbours.k`, 50 by default, read by `neighbourhoodOptions`), trimming each row whenever it grows past 2K so that memory never reaches the square of the number of nodes and pairing at most the first 200 identifiers of a paragraph; `cooccurrenceLinks` gives one undirected `related` link per pair at the `cooccurrence` confidence with the number of shared paragraphs as provenance, and `neighbourhoodToModel` writes the `neighbours` block of `model.json`; the model schema and the `Provenance` type gain the optional `count`.
- 1acb366: Confidence combination: `combineLinks` folds the links of every producer into one link per source, target, relation and attributes at `1 − Π(1 − cᵢ)` over its methods (`combineConfidences`, clamped to [0, 1] and rounded to four decimals), the glossary occurrences of a group counting as one method whose confidence grows from the base of the first by `confidence.glossary_occurrence.per_occurrence` per additional occurrence up to `cap` (`glossaryConfidence`, options read by `combineOptions`); every provenance is kept in canonical order, an exact duplicate listed once, and the function is pure and idempotent.
- 42b97f5: Gaps between contract and notes: `attachOperations` reports an operation note that names an API with an imported contract and matches none of its operations as `W-OPERATION-UNMATCHED`, a warning saying that the operation disappeared from the contract or that the note is ahead of it (a note that names no API, or one taken in an ambiguity, is not reported); the check joins the catalogue as a pipeline step with its documentation page; and the contract section of the `api` page flags every operation of the contract that no note describes yet, with their count in its heading.
- 2d7b65d: Displayed neighbourhood: `displayedNeighbourhood` computes for every entity its one-hop neighbours through the links of the model in either direction, typed entities and noteless keyword pages alike, each with its `kind`, the largest confidence and the relation of the most confident link between the two nodes and its `direction`, sorted by decreasing confidence then by identifier and truncated to `site.neighbourhood.size` (6 by default, 12 at most, read by `displayOptions`); `displayedNeighbourhoodToModel` writes the `displayed_neighbourhood` block of `model.json`, and the configuration schema gains `site.neighbourhood.size`.
- 116aca4: Links written in notes: `explicitLinks` turns every markdown link that resolves to a note into a link at the `explicit_link` confidence with the file, line, text and anchor as provenance, attaches a non-markdown target as a `documents` link from the resource, reports a missing target as `E-LINK-BROKEN`, and resolves `<source>:<path>` links and relative links climbing into a sibling source only when `inference.cross_source_links` is set, flagging them as `W-LINK-CROSS-SOURCE` otherwise; core gains the `Link` and `Provenance` types mirroring the model schema, and the checks catalogue registers `W-LINK-CROSS-SOURCE`.
- 75add70: Frontmatter references: `frontmatterLinks` turns every value of a reference-typed attribute that carries a relation in the profile into a link of that relation at the `frontmatter_ref` confidence, with the attributes the profile declares (`accesses` in `read` mode for `reads`), reversed for `inverse` attributes and with the attribute name as provenance; `resolveReference` and `indexEntities` resolve a value by identifier, by source-relative path, then by exact title; a value that matches nothing, several titles, a note of a type the attribute does not accept or a value that is not a string is reported as `W-REF-UNRESOLVED`, which the checks catalogue registers.
- 363d7d7: Linter and build parity: `LOCAL_CHECKS` names the checks the local scope computes, the linter reports a broken link with the entity and the wording of the build, the explicit links step takes its remediation from the catalogue, `concordance lint --format json` carries `scope` and `checks`, and a parity test compares the findings of the linter and of the build on every fixture corpus.
- 5f8e108: Mentions panel in two sections, written links and recognised mentions, grouped by citing file in collapsible groups; the first `build.mentions_inline` mentions in the served HTML, the rest in one `fragments/<id>.mentions.json` per entity, embedded in the page under two hundred mentions and fetched on demand beyond; the island adds sorting, filtering and a collapse-all; occurrences and mention provenances carry the matched text and its passage.
- f34c511: Type-driven neighbour order: `displayedNeighbourhood` groups the neighbours of a page by the rank of their type in the `display.neighbours_order` the profile declares for the page's type (operations first on an API, accessed objects on a screen, what it applies to on a rule; unlisted types and keyword pages last), then by decreasing confidence and identifier, and truncates after that ordering; every `DisplayedNeighbour` carries its `rank`, written to the `displayed_neighbourhood` block of `model.json`, so that a panel separates the groups without knowing any type; a type without a declaration keeps the order by confidence; the neighbourhood slot renders the list as received and marks each change of rank with a separator. `neighbourOrder` exposes the declaration and the profile validation reports a `neighbours_order` naming an undeclared type.
- d0c0bc5: Operation notes: `attachOperations` matches every hand-written `endpoint` note to an operation imported from the contract of its API, on the frontmatter `operation_id`, then on the `method` and `path` pair (or `port` and title for SOAP), then on the title in comparison form, and merges the pair into the note, which keeps its identifier, markdown and frontmatter, takes the contract attributes it does not set, lists the contract as a representation and names the rung in `grouped_by` while the `exposes` link now points at the note; an ambiguous match is a `W-OPERATION-AMBIGUOUS` finding and attaches nothing. Entity representations gain the optional `kind` and `operation` fields.
- 66d7b33: `concordance build` runs the whole inference chain and exits 0 with a complete `model.json`: after ingestion, parsing and typing, the source plugins import their contracts, one recognition dictionary per locale is built, every note is scanned, the written links, frontmatter references, mentions and co-occurrences are produced and combined, the keyword pages are discovered and published, the markdown notes are reconciled as twin resources, the model checks of the registry run and every finding of every step is enriched and written once; `packages/cli/src/pipeline/` holds one module per step, the relation typing step calling `typeRelations` of the inference package. The build prints `render: not available in this version` instead of stopping with exit code 2, the summary and the log gain the keyword and twin-resource counts, and the model gains `build.contracts`, `candidates.objects` and `displayed_neighbourhood`, sorted by `assembleModel`. A `related` link that co-occurrence alone knows no longer raises `I-REL-AMBIGUOUS`. Keyword discovery leaves out the headings and the section labels a list item opens with (`- Reads:`): titles, not usage. A frontmatter reference to an existing note of a type the attribute does not accept gives its link, which the relation typing step drops with `E-META-REL`, instead of `W-REF-UNRESOLVED`. A `CheckLink` may carry its provenance: `W-API-CONSUMER-MISMATCH` counts as citations only the `serves` links read outside the API note, reads the `## Consumers` section as a declaration next to the attribute, and resolves declared consumers relative to the source of the note. A mention keeps the confidence the scan gave it (type prefix bonus, homonym factor) and the combined glossary confidence grows from the strongest occurrence. The default profile gives the `decisions` attribute of a meeting the `documents` relation.
- 84a3d54: Relation typing: `typeRelations` names the relation of every combined link from the profile on four rungs (mapped section, typed frontmatter attribute, type pair admitting a single relation, `related`), drops a relation the profile does not allow between the two types with `E-META-REL`, marks a pair-named link `relation_origin: pair` and turns it around when only the reverse pair admits the relation, caps `related` at the profile cap after the combination and reports one `I-REL-AMBIGUOUS` per remaining `related` link on its first provenance; `relationLabel` reads the display label of a relation, in either direction, from the profile, whose relations gain an optional `inverse_label`; the explicit link step leaves every link between two notes as `related` for that step, and `I-REL-AMBIGUOUS` becomes a step finding of the registry instead of a model check.
- cc77d53: Create the packages with their entry points and the build toolchain.
- f5cb89e: Mentions in a typed section: `mentionLinks` turns every occurrence of a note read in another note into a link, with the relation, attributes and direction of the section the profile maps for the type of the note at the `section_mention` confidence (section key and line as provenance) when the mention sits under a mapped H2 heading, and a `related` link at the base `glossary_occurrence` confidence otherwise; `mappedSection` matches a heading against the section key and every locale label of the profile without regard to case, accents or whitespace.
- c5048be: `concordance build` renders the site after the model and `concordance render` renders it again from `model.json` and the `fragments/<id>.json` written next to it, without touching a source: one `<id>/index.html` per entity and per keyword page with the note rendered to sanitised HTML, the home page, the alphabetical index, the to-do page, a search index placeholder and the assets, every href relative to its page so that `dist/` works over `file://` as behind a server, every page measured against the 150 kB budget and checked for accessibility, byte-identical from one rendering to the next. The site package gains the markdown renderer, the fragment format and the shared site assembly the gallery now uses; core orders the displayed neighbours by rank, then confidence, as the display step does; inference exposes `locateLink`.
- 0ef98c5: Twin resources: `resolveDuplicateResources` scores every pair of resources by adding its signals, capped at 1 (frontmatter declaration, same or close base name, property title equal to the heading, similar extracted text through 5-word shingles, a 128-function MinHash under a fixed seed and LSH banding with exact Jaccard verification according to `inference.duplicates.mode`, same commit, folder proximity), merges the pairs above `merge_above` into groups carrying every representation and the grouping criterion, reports the pairs from `candidate_above` as `W-DUP-CANDIDATE` with the score breakdown, applies the `merged` and `separated` pairs of the lock file and reports its statistics; `duplicateOptions` reads `inference.duplicates`, added to the configuration schema, and the model's entities gain the optional `representations` and `grouped_by`.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- Updated dependencies [203133d]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
- Updated dependencies [58aa2a7]
- Updated dependencies [ce3bc7c]
- Updated dependencies [0591795]
- Updated dependencies [24a33f7]
- Updated dependencies [f900830]
- Updated dependencies [2d7b65d]
- Updated dependencies [af10923]
- Updated dependencies [b5f0071]
- Updated dependencies [35aff55]
- Updated dependencies [116aca4]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [69cf231]
- Updated dependencies [ee71a72]
- Updated dependencies [e20e743]
- Updated dependencies [4154f49]
- Updated dependencies [a1c0353]
- Updated dependencies [1bbfecc]
- Updated dependencies [b9e4031]
- Updated dependencies [34c5a53]
- Updated dependencies [4bd6bd7]
- Updated dependencies [b092a63]
- Updated dependencies [8ca9305]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [efb8c03]
- Updated dependencies [07c9269]
- Updated dependencies [2fe703f]
- Updated dependencies [f34c511]
- Updated dependencies [38a63c6]
- Updated dependencies [de7f8a2]
- Updated dependencies [64664a4]
- Updated dependencies [d0c0bc5]
- Updated dependencies [ef6d6fe]
- Updated dependencies [66d7b33]
- Updated dependencies [ce3f837]
- Updated dependencies [676a36a]
- Updated dependencies [c995c47]
- Updated dependencies [a5ef5ff]
- Updated dependencies [84a3d54]
- Updated dependencies [2922261]
- Updated dependencies [cc77d53]
- Updated dependencies [c5048be]
- Updated dependencies [a814a6e]
- Updated dependencies [cc3beed]
- Updated dependencies [a954edf]
- Updated dependencies [0ef98c5]
- Updated dependencies [14088cd]
- Updated dependencies [c623d60]
- Updated dependencies [1a5f84d]
- Updated dependencies [c1a3598]
- Updated dependencies [c54d224]
- Updated dependencies [223a319]
  - @concordance-wiki/core@0.1.0
  - @concordance-wiki/profile@0.1.0
  - @concordance-wiki/ingest@0.1.0
