---
"@concordance-wiki/site": minor
---

Textual equivalent of the neighbourhood map: the list of neighbours follows the figure inside the same section, never hidden, the figure hidden from assistive technologies and pointing at it with `aria-describedby`; each entry names the entity, its type label and the nature of the link, the relation now read from the page (`relationLabel` takes an `inverse` option and the build uses the `inverse_label` of the profile for a link pointing at the page); the list stays plain text in the served HTML, where the search index reads it, and the axe audit covers an entity page with a six-node map and one where the pointer replaces the map.
