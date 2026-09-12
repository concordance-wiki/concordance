---
"@concordance-wiki/inference": minor
---

Confidence combination: `combineLinks` folds the links of every producer into one link per source, target, relation and attributes at `1 − Π(1 − cᵢ)` over its methods (`combineConfidences`, clamped to [0, 1] and rounded to four decimals), the glossary occurrences of a group counting as one method whose confidence grows from the base of the first by `confidence.glossary_occurrence.per_occurrence` per additional occurrence up to `cap` (`glossaryConfidence`, options read by `combineOptions`); every provenance is kept in canonical order, an exact duplicate listed once, and the function is pure and idempotent.
