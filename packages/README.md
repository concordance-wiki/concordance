# packages

Core packages, published under `@concordance-wiki/*`. Each one compiles and exposes its entry point; the public API grows story by story. This page states what each one owns.

| Package | Owns | Depends on |
|---|---|---|
| `core` | model types, identifier computation, canonical sorting, deterministic utilities, injected interfaces (file system, git, fetcher, clock), plugin API and registry | — |
| `profile` | profile loading, validation, merge, allowed relation matrix | core |
| `ingest` | git clone at depth 1, cache, file reading, markdown and frontmatter parsing | core |
| `typing` | type cascade, identifiers, application and domain resolution | core, profile |
| `nlp` | normalisation, Aho-Corasick, n-grams, C-value, MinHash, language packs `en` and `fr` | core |
| `inference` | link production, confidence combination, relation typing, bounded neighbourhood, term candidates | core, ingest, nlp, profile |
| `checks` | check registry shared by build and linter | core, profile |
| `i18n` | message catalogues of the site (`en`, `fr`), typed identifiers, build-time resolution, platform date, number and relative time formatting | core |
| `site` | slots and view models, default theme, islands and their bundles, stylesheet layers, page budget; later the i18n catalogue and the search index | core, profile |
| `ui` | client components: mentions panel, mini-map, viewer slots, pinned pages | — |
| `cli` | `build`, `render`, `init`, `validate-config`, `lint` | all |
| `lint` | distributable linter and its packagings | core, profile, typing, checks, ingest |

Rules that apply to every package: strict TypeScript, ESM, one entry point, 100% line and branch coverage, no dependency on any office format or system tool, no import of a plugin. Layout: `src/` compiled to `dist/`, `test/` run by Vitest against the sources, `tsconfig.json` for type checking and `tsconfig.build.json` for emitting.
