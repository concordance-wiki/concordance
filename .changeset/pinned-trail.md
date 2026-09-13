---
"@concordance-wiki/site": minor
---

Pinnable navigation trail: the `trail` island of the header lists the pages the reader visited, in order, each a link, the current page marked and appended once; the trail travels in the URL fragment as `#trail=<id>,<id>` so that a link shares it and a reload restores it, every internal link carrying it when followed and the tab keeping it in `sessionStorage`; a pin button stores it, titles included, in `localStorage` under `concordance-trail` for the next visits and unpinning forgets it; beyond twelve entries the oldest fold into one expandable "… N earlier pages" entry and beyond fifty they are dropped; the island is served empty, so that without JavaScript the region takes no space, loads no framework and fetches nothing, and the `Header` slot receives `trail: { base, current?, labels }` with the `trail.*` messages of the catalogue, `trail.earlier` being new.
