---
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
"@concordance-wiki/cli": minor
---

Home page with three entry points: the number of sources and files with the date of the build spelled in the project locale, a search region (`data-slot="search"`) with the twelve most cited pages as shortcuts, a note counted by the links pointing at it and a keyword page by its occurrences, then three entry points of equal standing: the file tree, one folding block per source with its folders and notes; the letters of the alphabetical index with their counts; the twenty latest changes with their git date and the freshness of every source, flagged dormant when its newest change is older than `staleness.warn_after_days` (180 days by default), which `concordance build` and `concordance render` now pass to the site; a link to the to-do page with its count; no dashboard, no metric, no chart. The `Home` view model gains `builtAtLabel`, `dateLabel`, `tree`, `sources` and `todo`, and the entry `href` becomes optional; the catalogues gain `home.tree`, `home.index` and `home.recent`.
