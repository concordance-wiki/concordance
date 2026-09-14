# @concordance-wiki/profile

## 0.1.0

### Minor Changes

- 58aa2a7: Category list: every folder at the top of a space gets a page at the folder's address, `<source>/<folder>/index.html`, with the tree of the space on the left, this folder marked, the breadcrumb, the title, the count of notes worded by the type and the one-sentence description of the type, the selectors of the first highlighted attribute and of the sort, the table of notes with the attribute, the first line and the number of related pages of each, the rows shown of the whole and the note on the links column; the selectors link to pre-rendered variants while the sorts times the values give twelve pages at most, else the `category-list` island applies the choice in place, the page reading by title without JavaScript; the search field of the page asks to search in the category and submits with its space and type; the folders of the space tree and the first folder of the breadcrumb of an entity page link to their lists; the type modules and the profile gain an optional `description` and `counted` message per type, filled for every core type in English and French; `formatText` resolves an ICU message that lives outside the catalogues.
- f34c511: Type-driven neighbour order: `displayedNeighbourhood` groups the neighbours of a page by the rank of their type in the `display.neighbours_order` the profile declares for the page's type (operations first on an API, accessed objects on a screen, what it applies to on a rule; unlisted types and keyword pages last), then by decreasing confidence and identifier, and truncates after that ordering; every `DisplayedNeighbour` carries its `rank`, written to the `displayed_neighbourhood` block of `model.json`, so that a panel separates the groups without knowing any type; a type without a declaration keeps the order by confidence; the neighbourhood slot renders the list as received and marks each change of rank with a separator. `neighbourOrder` exposes the declaration and the profile validation reports a `neighbours_order` naming an undeclared type.
- 64664a4: Add the `contract-openapi` plugin: the OpenAPI 3.x contract an `api` note declares through its `contract` attribute, as a URL or a path, is read (JSON or YAML) and produces one `endpoint` entity per operation with its method, path, summary and operation identifier, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the referenced schemas as candidate objects, and a record of the contract version with its import date; the extracted contract is cached by the SHA-256 of its bytes and an unreachable or unparsable contract yields `W-CONTRACT-UNREACHABLE` without stopping the build. The core types the source contribution (`SourcePayload`, `PluginContext` with `fs`, `clock` and an optional `fetch`, `SourceOutput` with entities, links, candidates, contracts and findings), records `contracts` in the build log and in the model schema (`build.contracts`, `candidates.objects`); the checks catalogue gains `W-CONTRACT-UNREACHABLE`; the default profile gains the `exposes` relation from `api` to `endpoint`.
- 66d7b33: `concordance build` runs the whole inference chain and exits 0 with a complete `model.json`: after ingestion, parsing and typing, the source plugins import their contracts, one recognition dictionary per locale is built, every note is scanned, the written links, frontmatter references, mentions and co-occurrences are produced and combined, the keyword pages are discovered and published, the markdown notes are reconciled as twin resources, the model checks of the registry run and every finding of every step is enriched and written once; `packages/cli/src/pipeline/` holds one module per step, the relation typing step calling `typeRelations` of the inference package. The build prints `render: not available in this version` instead of stopping with exit code 2, the summary and the log gain the keyword and twin-resource counts, and the model gains `build.contracts`, `candidates.objects` and `displayed_neighbourhood`, sorted by `assembleModel`. A `related` link that co-occurrence alone knows no longer raises `I-REL-AMBIGUOUS`. Keyword discovery leaves out the headings and the section labels a list item opens with (`- Reads:`): titles, not usage. A frontmatter reference to an existing note of a type the attribute does not accept gives its link, which the relation typing step drops with `E-META-REL`, instead of `W-REF-UNRESOLVED`. A `CheckLink` may carry its provenance: `W-API-CONSUMER-MISMATCH` counts as citations only the `serves` links read outside the API note, reads the `## Consumers` section as a declaration next to the attribute, and resolves declared consumers relative to the source of the note. A mention keeps the confidence the scan gave it (type prefix bonus, homonym factor) and the combined glossary confidence grows from the strongest occurrence. The default profile gives the `decisions` attribute of a meeting the `documents` relation.
- 676a36a: Load the embedded default profile, merge a project profile on top of it key by key (arrays replaced, `allowed` pairs added), validate the result against the schema and its declared slugs, fingerprint it, and answer the allowed relation matrix for a pair of types; `describeSchemaError` becomes public in core.
- 84a3d54: Relation typing: `typeRelations` names the relation of every combined link from the profile on four rungs (mapped section, typed frontmatter attribute, type pair admitting a single relation, `related`), drops a relation the profile does not allow between the two types with `E-META-REL`, marks a pair-named link `relation_origin: pair` and turns it around when only the reverse pair admits the relation, caps `related` at the profile cap after the combination and reports one `I-REL-AMBIGUOUS` per remaining `related` link on its first provenance; `relationLabel` reads the display label of a relation, in either direction, from the profile, whose relations gain an optional `inverse_label`; the explicit link step leaves every link between two notes as `related` for that step, and `I-REL-AMBIGUOUS` becomes a step finding of the registry instead of a model check.
- cc77d53: Create the packages with their entry points and the build toolchain.
- c623d60: Types as modules: a type is a folder `types/<slug>/` holding `type.yaml`, `messages/<language>.json`, `template.md` and optionally `schema.json` and `components/`, published by `type-module.schema.json`; the core types are such modules under `packages/profile/types/`, the default profile is assembled from them, and `resolveProfile` merges the modules a caller reads (`readTypeModules`) before the project profile, which may name a folder of modules under `types_dir`. A plugin contributes modules through the new `types` contribution point (registered in declared order, two plugins bringing one slug being a configuration error); the build and the render merge the modules of the plugins and of `types_dir` before the project profile, the global lint reads `types_dir`, and `concordance init --templates` also copies the templates of the types the declared plugins contribute. The entity page exposes the declaration of its type, labels every attribute as the profile does and lists the undeclared ones in an "other attributes" panel; a theme (`components`) or a type module (`components/`) provides `EntityPage@<type>`, `Attribute@<name>` and `Section@<key>` components, resolved theme first, then module, then default; and the gallery renders every registered type from its template, through its dedicated component when one exists.
- 223a319: Add the `contract-wsdl` plugin: the WSDL 1.1 or 2.0 contract an `api` note declares through its `contract` attribute produces one `endpoint` entity per port type or interface operation, titled `operation (port)`, with its port, binding, SOAP action and documentation, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the XSD elements and complex types its messages reference as candidate objects (inline schemas walked, imported names kept by name), and a contract record; an imported WSDL and an imported OpenAPI produce entities of the same shape. The loading shared by the contract plugins moves to the core (`loadContracts` with a `ContractReader`, the contract cache, `declaredContracts`, `xmlRootOf`); each plugin decides on content whether a contract is its business, so that an XML contract is left to the WSDL plugin and anything else to the OpenAPI plugin; the `W-CONTRACT-UNREACHABLE` remediation no longer names one format. Endpoints from both plugins carry a `style` attribute (`http` or `soap`); the default profile declares `style`, `port`, `binding` and `soap_action` on the `endpoint` type.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- Updated dependencies [203133d]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
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
