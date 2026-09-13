---
"@concordance-wiki/core": minor
"@concordance-wiki/site": minor
"@concordance-wiki/i18n": minor
"@concordance-wiki/cli": minor
---

Navigation: every folder of a space, at every depth, gets the list of its notes at its address, and a space whose every note is dated gets one per year and per month; every folder of the space tree and of the breadcrumb links to its list, the head of the tree in the left column links to the page of the space, and the list of a folder below the top leads with "N pages filed under rules › links". The configuration gains `sources[].title`, `sources[].folders` (a title and a description per folder path) and `project.contribute_url`, validated by the schema: every call to action, "Propose a definition" and "Edit this page", leads to the forge when a link can be built, else to `project.contribute_url`, and is not shown otherwise; the path of the file under a note links to the file on its forge.
