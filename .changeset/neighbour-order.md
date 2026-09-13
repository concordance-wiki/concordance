---
"@concordance-wiki/inference": minor
"@concordance-wiki/profile": minor
"@concordance-wiki/core": minor
"@concordance-wiki/site": minor
---

Type-driven neighbour order: `displayedNeighbourhood` groups the neighbours of a page by the rank of their type in the `display.neighbours_order` the profile declares for the page's type (operations first on an API, accessed objects on a screen, what it applies to on a rule; unlisted types and keyword pages last), then by decreasing confidence and identifier, and truncates after that ordering; every `DisplayedNeighbour` carries its `rank`, written to the `displayed_neighbourhood` block of `model.json`, so that a panel separates the groups without knowing any type; a type without a declaration keeps the order by confidence; the neighbourhood slot renders the list as received and marks each change of rank with a separator. `neighbourOrder` exposes the declaration and the profile validation reports a `neighbours_order` naming an undeclared type.
