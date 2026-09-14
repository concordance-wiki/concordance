# @concordance-wiki/plugin-contract-openapi

## 0.1.0

### Minor Changes

- 378a546: API page: the page of an `api` whose contract was imported is laid out as an interface, its operations under it in the tree of the space, the operations table after the note (the method as a chip, the path, the operation note linked, how many pages cite it, then in italics the operations the contract declares without a page and the notes the contract does not declare), the contract block with its format, its file, its import date, its download link and the viewer behind its button, the properties cut to five keys and the operations first among the related pages; the contract readers name the format they read and the contract record carries it; the `api.*` messages word the page in English and French; the gallery gains the `api-page-corporate` state.
- ce3bc7c: Contract viewer: the page of an `api` entity whose contract was imported shows the contract after the note without copying it into the markdown, as a static section (title, version, import date, the operations as a plain list, a "Download the contract" link to the declared URL or to the copy of a path contract placed next to the page) and a `contract-viewer` island that fetches `fragments/<api id>.contract.json` on demand only and renders an expandable operation list and a schema explorer for HTTP and SOAP contracts alike, with no form and no request to the API described; the contract loader of the core writes that view next to the cached contract at every load (`ContractView`, `cachedContractViewPath`), the OpenAPI and WSDL readers now keep the parameters, request and response types and the referenced schema definitions for it, the build copies the view and the path contract under `fragments/` and `render` places them; the viewer is the first UI component contribution of the default theme (`defaultThemeManifest`), registered as a built-in ahead of the declared plugins (`builtin` in the plugin loader dependencies) so that the registry lists it and no plugin claims its slot, and the site bundles the UI components a plugin contributes next to its own islands.
- 64664a4: Add the `contract-openapi` plugin: the OpenAPI 3.x contract an `api` note declares through its `contract` attribute, as a URL or a path, is read (JSON or YAML) and produces one `endpoint` entity per operation with its method, path, summary and operation identifier, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the referenced schemas as candidate objects, and a record of the contract version with its import date; the extracted contract is cached by the SHA-256 of its bytes and an unreachable or unparsable contract yields `W-CONTRACT-UNREACHABLE` without stopping the build. The core types the source contribution (`SourcePayload`, `PluginContext` with `fs`, `clock` and an optional `fetch`, `SourceOutput` with entities, links, candidates, contracts and findings), records `contracts` in the build log and in the model schema (`build.contracts`, `candidates.objects`); the checks catalogue gains `W-CONTRACT-UNREACHABLE`; the default profile gains the `exposes` relation from `api` to `endpoint`.
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
