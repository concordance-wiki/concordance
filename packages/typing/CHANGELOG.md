# @concordance-wiki/typing

## 0.1.0

### Minor Changes

- 050d8a7: Extracted text indexed: `concordance build` gains a documents step that reads every file a reader or a converter of the plugins accepts, types it as an entity (identifier with its extension, metadata as attributes, the source rules and their `ext` matches applied), converts office documents to PDF in parallel (`conversion.parallelism`, `convert: false` per source) and takes their text from the pages of that PDF only, so that there is a single extraction path; the `convert-libreoffice` plugin produces a `text` representation (`<sha256>.text.json`, one entry per page) next to every PDF and a second converter keeps `.pdf` sources as their own representation; the `reader-vtt` plugin returns `units`, one per speaker turn with its timecode, a new optional field of `ReaderOutput`; the scan, the keyword discovery and the twin reconciliation read the pages of the documents, an occurrence in a document carrying the page, slide or cue number as its line and its label as its section, so that the mentions panel cites `slide 3` or `00:12:05` instead of a line; a document that still has no markdown representation once the twins are reconciled yields `W-DOC-NOMD`; the fragment of an entity lists its `documents` with the text of every page cut at `build.extracted_text_max_chars` and joined as its `text`, and the build keeps the original file and its PDF under `fragments/<id>/` for `render` to place next to the page; a failed conversion counts for `build.fail_on.unconverted_max`.
- 69cf231: Folder domains: a domain accepts `folder: true` or `folder: <name>` and claims every file with a directory of that name on its path in any source, a folder subdomain claims only the files under its parent's folder (anywhere on a path the parent's globs match when the parent is declared by globs), folders and globs combine on the same domain with the same precedence, the origin `folder` joins `frontmatter`, `glob` and `unclassified`, `validate-config` rejects a folder name that is not a single path segment, and the minimal corpus declares a `quality` domain by folder with a `determinism` folder subdomain.
- 327897e: Global domains and applications: `compileDomains` and `resolveDomain` file every note under the frontmatter `domain`, else under the deepest domain whose globs match its source-relative path (globs are declared once and evaluated across every source), else under `unclassified` with `W-DOMAIN-UNCLASSIFIED`; `resolveApplication` takes the frontmatter `application`, else a rule's `set.application`, else the source's, and reports `W-APP-MISSING` when none applies; a value the configuration does not declare is kept as written and reported as `W-DOMAIN-UNKNOWN` or `W-APP-UNKNOWN`. The typing step is the producer of these findings, so the checks catalogue registers them as step checks and no longer computes `W-APP-MISSING` and `W-DOMAIN-UNCLASSIFIED` from the model; it also registers `W-TYPE-UNKNOWN` and `W-ATTRIBUTE-UNKNOWN`.
- cc77d53: Create the packages with their entry points and the build toolchain.
- 14088cd: Type cascade: `resolveType` applies the source's `default_type` and `type`, the typing rules in order (`path`, `suffix`, `ext` and `frontmatter` criteria, the last match wins) and the frontmatter `type`, keeps the origin (`source`, `rule#3`, `suffix`, `frontmatter`), reports `E-TYPE-CONFLICT` and `W-TYPE-UNKNOWN`; `buildEntity` and `typeSources` turn parsed markdown files into `Entity` values (identifier, title, aliases, status, summary, attributes with `W-ATTRIBUTE-UNKNOWN`, source location, `graph`) with duplicates resolved and everything in canonical order; core gains the `Entity` model, `compareEntities` and the optional `graph` property of an entity in the model schema.

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
