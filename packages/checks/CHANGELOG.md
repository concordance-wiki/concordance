# @concordance-wiki/checks

## 0.1.0

### Minor Changes

- b64b730: Shared check registry: a catalogue of every documented check with its default severity, family, description, remediation and documentation URL, five checks computed as pure functions over the model (`W-API-NOCONSUMER`, `W-API-CONSUMER-MISMATCH`, `W-APP-MISSING`, `W-DOMAIN-UNCLASSIFIED`, `I-REL-AMBIGUOUS`), and `createRegistry` which merges plugin contributions, runs the enabled checks, applies the `checks:` overrides to computed and step findings alike and refuses an unknown identifier.
- 42b97f5: Gaps between contract and notes: `attachOperations` reports an operation note that names an API with an imported contract and matches none of its operations as `W-OPERATION-UNMATCHED`, a warning saying that the operation disappeared from the contract or that the note is ahead of it (a note that names no API, or one taken in an ambiguity, is not reported); the check joins the catalogue as a pipeline step with its documentation page; and the contract section of the `api` page flags every operation of the contract that no note describes yet, with their count in its heading.
- 116aca4: Links written in notes: `explicitLinks` turns every markdown link that resolves to a note into a link at the `explicit_link` confidence with the file, line, text and anchor as provenance, attaches a non-markdown target as a `documents` link from the resource, reports a missing target as `E-LINK-BROKEN`, and resolves `<source>:<path>` links and relative links climbing into a sibling source only when `inference.cross_source_links` is set, flagging them as `W-LINK-CROSS-SOURCE` otherwise; core gains the `Link` and `Provenance` types mirroring the model schema, and the checks catalogue registers `W-LINK-CROSS-SOURCE`.
- 69cf231: Folder domains: a domain accepts `folder: true` or `folder: <name>` and claims every file with a directory of that name on its path in any source, a folder subdomain claims only the files under its parent's folder (anywhere on a path the parent's globs match when the parent is declared by globs), folders and globs combine on the same domain with the same precedence, the origin `folder` joins `frontmatter`, `glob` and `unclassified`, `validate-config` rejects a folder name that is not a single path segment, and the minimal corpus declares a `quality` domain by folder with a `determinism` folder subdomain.
- 75add70: Frontmatter references: `frontmatterLinks` turns every value of a reference-typed attribute that carries a relation in the profile into a link of that relation at the `frontmatter_ref` confidence, with the attributes the profile declares (`accesses` in `read` mode for `reads`), reversed for `inverse` attributes and with the attribute name as provenance; `resolveReference` and `indexEntities` resolve a value by identifier, by source-relative path, then by exact title; a value that matches nothing, several titles, a note of a type the attribute does not accept or a value that is not a string is reported as `W-REF-UNRESOLVED`, which the checks catalogue registers.
- 327897e: Global domains and applications: `compileDomains` and `resolveDomain` file every note under the frontmatter `domain`, else under the deepest domain whose globs match its source-relative path (globs are declared once and evaluated across every source), else under `unclassified` with `W-DOMAIN-UNCLASSIFIED`; `resolveApplication` takes the frontmatter `application`, else a rule's `set.application`, else the source's, and reports `W-APP-MISSING` when none applies; a value the configuration does not declare is kept as written and reported as `W-DOMAIN-UNKNOWN` or `W-APP-UNKNOWN`. The typing step is the producer of these findings, so the checks catalogue registers them as step checks and no longer computes `W-APP-MISSING` and `W-DOMAIN-UNCLASSIFIED` from the model; it also registers `W-TYPE-UNKNOWN` and `W-ATTRIBUTE-UNKNOWN`.
- 64664a4: Add the `contract-openapi` plugin: the OpenAPI 3.x contract an `api` note declares through its `contract` attribute, as a URL or a path, is read (JSON or YAML) and produces one `endpoint` entity per operation with its method, path, summary and operation identifier, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the referenced schemas as candidate objects, and a record of the contract version with its import date; the extracted contract is cached by the SHA-256 of its bytes and an unreachable or unparsable contract yields `W-CONTRACT-UNREACHABLE` without stopping the build. The core types the source contribution (`SourcePayload`, `PluginContext` with `fs`, `clock` and an optional `fetch`, `SourceOutput` with entities, links, candidates, contracts and findings), records `contracts` in the build log and in the model schema (`build.contracts`, `candidates.objects`); the checks catalogue gains `W-CONTRACT-UNREACHABLE`; the default profile gains the `exposes` relation from `api` to `endpoint`.
- d0c0bc5: Operation notes: `attachOperations` matches every hand-written `endpoint` note to an operation imported from the contract of its API, on the frontmatter `operation_id`, then on the `method` and `path` pair (or `port` and title for SOAP), then on the title in comparison form, and merges the pair into the note, which keeps its identifier, markdown and frontmatter, takes the contract attributes it does not set, lists the contract as a representation and names the rung in `grouped_by` while the `exposes` link now points at the note; an ambiguous match is a `W-OPERATION-AMBIGUOUS` finding and attaches nothing. Entity representations gain the optional `kind` and `operation` fields.
- 66d7b33: `concordance build` runs the whole inference chain and exits 0 with a complete `model.json`: after ingestion, parsing and typing, the source plugins import their contracts, one recognition dictionary per locale is built, every note is scanned, the written links, frontmatter references, mentions and co-occurrences are produced and combined, the keyword pages are discovered and published, the markdown notes are reconciled as twin resources, the model checks of the registry run and every finding of every step is enriched and written once; `packages/cli/src/pipeline/` holds one module per step, the relation typing step calling `typeRelations` of the inference package. The build prints `render: not available in this version` instead of stopping with exit code 2, the summary and the log gain the keyword and twin-resource counts, and the model gains `build.contracts`, `candidates.objects` and `displayed_neighbourhood`, sorted by `assembleModel`. A `related` link that co-occurrence alone knows no longer raises `I-REL-AMBIGUOUS`. Keyword discovery leaves out the headings and the section labels a list item opens with (`- Reads:`): titles, not usage. A frontmatter reference to an existing note of a type the attribute does not accept gives its link, which the relation typing step drops with `E-META-REL`, instead of `W-REF-UNRESOLVED`. A `CheckLink` may carry its provenance: `W-API-CONSUMER-MISMATCH` counts as citations only the `serves` links read outside the API note, reads the `## Consumers` section as a declaration next to the attribute, and resolves declared consumers relative to the source of the note. A mention keeps the confidence the scan gave it (type prefix bonus, homonym factor) and the combined glossary confidence grows from the strongest occurrence. The default profile gives the `decisions` attribute of a meeting the `documents` relation.
- c995c47: Pseudonymisation is applied by the build: the dictionary of `privacy.pseudonymize` is read and validated (`W-PRIVACY-DICTIONARY` when it is missing or malformed, an error that fails the build and withholds every transcript when pseudonymisation is enabled), every transcript is pseudonymised before typing in its cues, its metadata and the file offered for download, which readers write back through a new optional `rewrite` (implemented for VTT and SRT; `W-PRIVACY-WITHHELD` for a reader without it), the notes and documents of the scope types are replaced the same way, the real names are rejected from keyword discovery, and transcripts are withheld altogether unless `privacy.publish_transcripts` is true.
- 84a3d54: Relation typing: `typeRelations` names the relation of every combined link from the profile on four rungs (mapped section, typed frontmatter attribute, type pair admitting a single relation, `related`), drops a relation the profile does not allow between the two types with `E-META-REL`, marks a pair-named link `relation_origin: pair` and turns it around when only the reverse pair admits the relation, caps `related` at the profile cap after the combination and reports one `I-REL-AMBIGUOUS` per remaining `related` link on its first provenance; `relationLabel` reads the display label of a relation, in either direction, from the profile, whose relations gain an optional `inverse_label`; the explicit link step leaves every link between two notes as `related` for that step, and `I-REL-AMBIGUOUS` becomes a step finding of the registry instead of a model check.
- cc77d53: Create the packages with their entry points and the build toolchain.
- 223a319: Add the `contract-wsdl` plugin: the WSDL 1.1 or 2.0 contract an `api` note declares through its `contract` attribute produces one `endpoint` entity per port type or interface operation, titled `operation (port)`, with its port, binding, SOAP action and documentation, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the XSD elements and complex types its messages reference as candidate objects (inline schemas walked, imported names kept by name), and a contract record; an imported WSDL and an imported OpenAPI produce entities of the same shape. The loading shared by the contract plugins moves to the core (`loadContracts` with a `ContractReader`, the contract cache, `declaredContracts`, `xmlRootOf`); each plugin decides on content whether a contract is its business, so that an XML contract is left to the WSDL plugin and anything else to the OpenAPI plugin; the `W-CONTRACT-UNREACHABLE` remediation no longer names one format. Endpoints from both plugins carry a `style` attribute (`http` or `soap`); the default profile declares `style`, `port`, `binding` and `soap_action` on the `endpoint` type.

### Patch Changes

- 32465c6: The string literals of the check catalogue carry a mutation-testing directive that keeps them out of the mutated set; nothing changes for the users of the package.
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
- Updated dependencies [116aca4]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [69cf231]
- Updated dependencies [ee71a72]
- Updated dependencies [e20e743]
- Updated dependencies [4154f49]
- Updated dependencies [a1c0353]
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
