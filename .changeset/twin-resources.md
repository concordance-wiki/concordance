---
"@concordance-wiki/inference": minor
"@concordance-wiki/core": minor
---

Twin resources: `resolveDuplicateResources` scores every pair of resources by adding its signals, capped at 1 (frontmatter declaration, same or close base name, property title equal to the heading, similar extracted text through 5-word shingles, a 128-function MinHash under a fixed seed and LSH banding with exact Jaccard verification according to `inference.duplicates.mode`, same commit, folder proximity), merges the pairs above `merge_above` into groups carrying every representation and the grouping criterion, reports the pairs from `candidate_above` as `W-DUP-CANDIDATE` with the score breakdown, applies the `merged` and `separated` pairs of the lock file and reports its statistics; `duplicateOptions` reads `inference.duplicates`, added to the configuration schema, and the model's entities gain the optional `representations` and `grouped_by`.
