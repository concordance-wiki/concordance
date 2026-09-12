---
"@concordance-wiki/inference": minor
"@concordance-wiki/core": minor
---

Displayed neighbourhood: `displayedNeighbourhood` computes for every entity its one-hop neighbours through the links of the model in either direction, typed entities and noteless keyword pages alike, each with its `kind`, the largest confidence and the relation of the most confident link between the two nodes and its `direction`, sorted by decreasing confidence then by identifier and truncated to `site.neighbourhood.size` (6 by default, 12 at most, read by `displayOptions`); `displayedNeighbourhoodToModel` writes the `displayed_neighbourhood` block of `model.json`, and the configuration schema gains `site.neighbourhood.size`.
