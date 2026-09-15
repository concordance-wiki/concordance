# @concordance-wiki/lint

## 0.3.1

### Patch Changes

- 0a4f169: The SARIF log no longer carries `originalUriBaseIds`: the base URI named the folder of the machine that ran the lint, so two checkouts of the same tree gave different logs. Artifact locations keep their `uriBaseId` of `%SRCROOT%`, which the forges resolve against their checkout.
- Updated dependencies [6a4fcf6]
  - @concordance-wiki/core@0.3.1
  - @concordance-wiki/checks@0.3.1
  - @concordance-wiki/ingest@0.3.1
  - @concordance-wiki/nlp@0.3.1
  - @concordance-wiki/profile@0.3.1
  - @concordance-wiki/typing@0.3.1

## 0.3.0

### Patch Changes

- f8aad74: A local source, a stopword file and the locations of the global lint block are resolved as the platform resolves paths: on Windows a `path` source relative to the configuration was reported unreachable.
- Updated dependencies [7c56d0a]
- Updated dependencies [f8aad74]
  - @concordance-wiki/core@0.3.0
  - @concordance-wiki/ingest@0.3.0
  - @concordance-wiki/nlp@0.3.0
  - @concordance-wiki/checks@0.3.0
  - @concordance-wiki/profile@0.3.0
  - @concordance-wiki/typing@0.3.0

## 0.2.0

### Patch Changes

- 0adb9b5: Commands are located by an absolute path, never by a name looked up on the `PATH`: the build takes `git` from the system directories of the platform, or from `CONCORDANCE_GIT`; the linter orders the suffixes of a source by code unit, as every other list.
- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [0adb9b5]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
  - @concordance-wiki/core@0.2.0
  - @concordance-wiki/checks@0.2.0
  - @concordance-wiki/typing@0.2.0
  - @concordance-wiki/ingest@0.2.0
  - @concordance-wiki/nlp@0.2.0
  - @concordance-wiki/profile@0.2.0

## 0.1.0

### Minor Changes

- 21293ea: Reports for forges: `concordance lint --format json|sarif|junit` prints the findings as a JSON document with the documentation URL on each finding and the counts, as a SARIF 2.1.0 log with one rule per check and one result per finding located by file and line for the diff margin, or as a JUnit suite with one failing test case per error or warning; `--output <file>` writes the report to a file instead of standard output, and the exit codes follow `--fail-on` whatever the format (`formatFindingsAs`, `formatJson`, `formatSarif` and `formatJunit` in the lint package).
- e20e743: Global lint without rebuilding: `concordance lint --scope global` reads the published `model.json` named by `global.model` in `concordance-lint.yaml` (a URL cached under `global.cache_dir` for `global.max_age_hours` and revalidated with `ETag` and `Last-Modified`, or a local path) and checks the local notes against its entities: `E-LINK-BROKEN` and `W-LINK-CROSS-SOURCE` for links into other sources, `E-META-REL` for frontmatter references against the profile matrix, `I-TERM-HOMONYM` for titles and aliases shared with an entity of another type; an unreachable model degrades to the local checks with one line on stderr and `degraded: true` in the JSON and SARIF reports; `lintGlobal`, `loadPublishedModel`, `globalFindings`, `GLOBAL_CHECKS`, `mergeFindings` and `readLintConfig` are exported, and the model's `build` block records `cross_source_links`.
- 363d7d7: Linter and build parity: `LOCAL_CHECKS` names the checks the local scope computes, the linter reports a broken link with the entity and the wording of the build, the explicit links step takes its remediation from the catalogue, `concordance lint --format json` carries `scope` and `checks`, and a parity test compares the findings of the linter and of the build on every fixture corpus.
- 3fb3d96: `concordance-lint.yaml` gains an `exclude` key, globs of the files of the repository that are never read, counted or reported, with the syntax of `privacy.exclude`; the file is validated against a published `lint.schema.json`, documented by a generated reference page. The files git ignores are left out the same way, every `.gitignore` of the repository being read with the rules git applies, and `concordance lint --no-gitignore` checks them anyway. The build lists the files of a source exactly as the linter does, honouring the `exclude` of the repository and its ignore files, and skips with a `W-SOURCE-UNREACHABLE` finding a source whose lint configuration is faulty; the parity test holds it on an excluded folder and an ignored file of the faulty corpora.
- 3ae5687: Local lint without network: `concordance lint --scope repo` checks the current repository file by file (UTF-8 encoding, YAML frontmatter, identifiers unique once the source's type suffixes are stripped, internal links) with the rules of the source named by `--source` and the `checks` overrides of `--config` and of a `concordance-lint.yaml` at the root, prints the findings sorted with their documentation URL and their counts, and exits according to `--fail-on`; `--fix` and `--scope global` are refused until their stories land.
- 91c3305: Safe automatic fixes: `concordance lint --fix` adds the type deduced from the source rules to a frontmatter that has none, orders the frontmatter keys canonically and points a link to a missing file at the only file carrying that name, announcing every change before writing and refusing an ambiguous one; `--dry-run` lists the changes without writing. The lint package exports `fixRepository`, `normalizeFrontmatter`, `rewriteRenamedLinks` and `deduceType`.
- cc77d53: Create the packages with their entry points and the build toolchain.
- c623d60: Types as modules: a type is a folder `types/<slug>/` holding `type.yaml`, `messages/<language>.json`, `template.md` and optionally `schema.json` and `components/`, published by `type-module.schema.json`; the core types are such modules under `packages/profile/types/`, the default profile is assembled from them, and `resolveProfile` merges the modules a caller reads (`readTypeModules`) before the project profile, which may name a folder of modules under `types_dir`. A plugin contributes modules through the new `types` contribution point (registered in declared order, two plugins bringing one slug being a configuration error); the build and the render merge the modules of the plugins and of `types_dir` before the project profile, the global lint reads `types_dir`, and `concordance init --templates` also copies the templates of the types the declared plugins contribute. The entity page exposes the declaration of its type, labels every attribute as the profile does and lists the undeclared ones in an "other attributes" panel; a theme (`components`) or a type module (`components/`) provides `EntityPage@<type>`, `Attribute@<name>` and `Section@<key>` components, resolved theme first, then module, then default; and the gallery renders every registered type from its template, through its dedicated component when one exists.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- Updated dependencies [203133d]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
- Updated dependencies [58aa2a7]
- Updated dependencies [b64b730]
- Updated dependencies [42b97f5]
- Updated dependencies [ce3bc7c]
- Updated dependencies [0591795]
- Updated dependencies [b6db21f]
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
- Updated dependencies [75add70]
- Updated dependencies [327897e]
- Updated dependencies [e20e743]
- Updated dependencies [4154f49]
- Updated dependencies [a1c0353]
- Updated dependencies [1bbfecc]
- Updated dependencies [b9e4031]
- Updated dependencies [d5dc4b0]
- Updated dependencies [34c5a53]
- Updated dependencies [4bd6bd7]
- Updated dependencies [b092a63]
- Updated dependencies [8ca9305]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [77c55e5]
- Updated dependencies [efb8c03]
- Updated dependencies [07c9269]
- Updated dependencies [2fe703f]
- Updated dependencies [5f8e108]
- Updated dependencies [32465c6]
- Updated dependencies [f34c511]
- Updated dependencies [38a63c6]
- Updated dependencies [c290f2b]
- Updated dependencies [de7f8a2]
- Updated dependencies [64664a4]
- Updated dependencies [d0c0bc5]
- Updated dependencies [ef6d6fe]
- Updated dependencies [66d7b33]
- Updated dependencies [ce3f837]
- Updated dependencies [676a36a]
- Updated dependencies [c995c47]
- Updated dependencies [a5ef5ff]
- Updated dependencies [7bbb659]
- Updated dependencies [22ee8ab]
- Updated dependencies [84a3d54]
- Updated dependencies [2922261]
- Updated dependencies [cc77d53]
- Updated dependencies [3fca4dd]
- Updated dependencies [23617d8]
- Updated dependencies [c5048be]
- Updated dependencies [a814a6e]
- Updated dependencies [cc3beed]
- Updated dependencies [af5cdd2]
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
  - @concordance-wiki/checks@0.1.0
  - @concordance-wiki/ingest@0.1.0
  - @concordance-wiki/nlp@0.1.0
  - @concordance-wiki/typing@0.1.0
