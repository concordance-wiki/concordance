---
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
---

Facets on the results page: type, source, domain and application, every value of the entity table listed with its count over the results of the current query, computed in the browser without a fetch beyond the shards; facets combine by intersection, a value nothing would come of stays listed at 0 and disabled, the selected values are recalled above the results with a link lifting each and one clearing them all, and the state of the search is the address of the page (`?q=…&type=…&source=…`). The build writes in `search/meta.js` the names of the sources, the counts of the whole table and the strings of the results page in the site language, plurals frozen by category; the catalogues gain `search.facet.source`, `search.activeFilters` and `search.removeFilter`; `SearchResultsProps` gains `summary`, `active`, `clearHref`, `labels` and `onNavigate`, and `FacetValue` gains `label`, `active` and `disabled`.
