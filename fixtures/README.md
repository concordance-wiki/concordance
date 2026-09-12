# Fixtures

Reference corpora for the tests. Every corpus is fictional: a generic personal insurer with invented vocabulary and no real name. Each exists in English (`en`) and French (`fr`) with the same structure, so that the language packs can be compared.

| Corpus | Purpose |
|---|---|
| `corpora/minimal` | a dozen files covering every implemented type, every typing path and the main inference methods; the first corpus every story runs against |
| `corpora/faulty` | one file per expected finding; the checks and the linter are tested here |
| `corpora/realistic` | a few hundred files with documents, transcripts, duplicates and deliberate errors; built by the golden corpus story |
| `generate` | a synthetic corpus generator for load tests |

Each corpus folder holds a `concordance.yaml` that declares its sources as local paths, and an `expected/` folder with the result the engine must produce. `expected/` changes only through a pull request that justifies the change.
