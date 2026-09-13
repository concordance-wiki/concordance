---
"@concordance-wiki/cli": minor
"@concordance-wiki/site": minor
"@concordance-wiki/core": minor
"@concordance-wiki/inference": minor
---

`concordance build` renders the site after the model and `concordance render` renders it again from `model.json` and the `fragments/<id>.json` written next to it, without touching a source: one `<id>/index.html` per entity and per keyword page with the note rendered to sanitised HTML, the home page, the alphabetical index, the to-do page, a search index placeholder and the assets, every href relative to its page so that `dist/` works over `file://` as behind a server, every page measured against the 150 kB budget and checked for accessibility, byte-identical from one rendering to the next. The site package gains the markdown renderer, the fragment format and the shared site assembly the gallery now uses; core orders the displayed neighbours by rank, then confidence, as the display step does; inference exposes `locateLink`.
