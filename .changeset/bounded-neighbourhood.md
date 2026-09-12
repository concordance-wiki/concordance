---
"@concordance-wiki/inference": minor
"@concordance-wiki/core": minor
---

Bounded neighbourhood: `accumulateCooccurrences` counts, per paragraph, the entities named together and keeps for every node its K best neighbours by count then by identifier (`inference.neighbours.k`, 50 by default, read by `neighbourhoodOptions`), trimming each row whenever it grows past 2K so that memory never reaches the square of the number of nodes and pairing at most the first 200 identifiers of a paragraph; `cooccurrenceLinks` gives one undirected `related` link per pair at the `cooccurrence` confidence with the number of shared paragraphs as provenance, and `neighbourhoodToModel` writes the `neighbours` block of `model.json`; the model schema and the `Provenance` type gain the optional `count`.
