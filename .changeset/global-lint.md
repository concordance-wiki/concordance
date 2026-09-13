---
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/core": minor
---

Global lint without rebuilding: `concordance lint --scope global` reads the published `model.json` named by `global.model` in `concordance-lint.yaml` (a URL cached under `global.cache_dir` for `global.max_age_hours` and revalidated with `ETag` and `Last-Modified`, or a local path) and checks the local notes against its entities: `E-LINK-BROKEN` and `W-LINK-CROSS-SOURCE` for links into other sources, `E-META-REL` for frontmatter references against the profile matrix, `I-TERM-HOMONYM` for titles and aliases shared with an entity of another type; an unreachable model degrades to the local checks with one line on stderr and `degraded: true` in the JSON and SARIF reports; `lintGlobal`, `loadPublishedModel`, `globalFindings`, `GLOBAL_CHECKS`, `mergeFindings` and `readLintConfig` are exported, and the model's `build` block records `cross_source_links`.
