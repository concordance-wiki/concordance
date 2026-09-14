---
"@concordance-wiki/core": minor
"@concordance-wiki/inference": minor
"@concordance-wiki/cli": minor
---

`inference.domains.max_neighbours`: the degree above which a term is a hub of the corpus rather than a domain and never a pivot. Without it the most cited words of a corpus win every tie and every proposal names them. A proposal now names the pivot's own domain when something files the pivot, so that an unclassified note joins the domain of the terms it is close to; a domain named after the pivot only when the pivot itself is unclassified.
