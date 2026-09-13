# Fixtures

Reference corpora for the tests. Every corpus speaks about Concordance itself: its glossary (links, entities, builds, mentions), the screens of the generated site, its checks and its pipeline, with pseudonymous participants and no real name. Each exists in English (`en`) and French (`fr`) with the same structure, so that the language packs can be compared.

| Corpus | Purpose |
|---|---|
| `corpora/minimal` | nineteen notes per language around the review of a link (glossary terms with a homonym for `build`, `entity` and `link`, the mentions panel, the entity page, the neighbourhood map, the model query API, the nightly build, the related link cap, one decision and one workshop), covering every implemented type, every typing path and the main inference methods; four notes intentionally match no domain, `build summary` recurs without a note and `cold start` stays under the keyword threshold; the first corpus every story runs against and the golden corpus of the determinism check |
| `corpora/faulty` | one note per expected finding, for every check a single file can trigger, written with the vocabulary of the tool (a model query API without consumer, an unknown `language_pack` type, a to-do page accessing a term); the checks and the linter are tested here |
| `corpora/realistic` | 120 notes per language in which Concordance describes itself, covering every implemented type, every inference method and every file-level check, with the expected model and findings; see its [README](corpora/realistic/README.md) |
| `generate` | a synthetic corpus generator for load tests |
| `plugins/example` | the smallest plugin that exercises every contribution point of the plugin API; loaded by the core tests, never published |
| `plugins/theme-example` | a theme plugin overriding the `Footer` slot alone; resolved through the registry and rendered by the site tests, never published |

Each corpus folder holds a `concordance.yaml` that declares its sources as local paths, and an `expected/` folder with the result the engine must produce: `entities.yaml` (identifier, type, type origin, application, domain), `links.yaml` (a minimum of links with their method and confidence), `findings.yaml` (every intended finding) and `keywords.yaml` (expressions above and below the keyword page threshold). `scripts/validate.mjs` checks that the expected files name things that exist, and the parity tests check that the `en` and `fr` corpora have the same structure. `expected/` changes only through a pull request that justifies the change.
