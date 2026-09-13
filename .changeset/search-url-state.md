---
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
---

Search state carried in the URL: the query and the selected facet values are the address of the results page (`?q=…&type=…&source=…&domain=…&application=…`), a facet followed pushes an entry to the history, typing rewrites the current entry once the reader pauses, the back and forward buttons replay the state of the address, and opening an address restores the query, the filters and the scroll position remembered per address in the session storage; the address is shown under the summary with a copy button when the browser exposes a clipboard. `mountSearch` takes the location, the scroll memory, the clipboard and a timer of the page, `SearchResultsProps` gains `address`, `copied` and `onCopy`, and the catalogues gain `search.address`, `search.copyAddress` and `search.copied`.
