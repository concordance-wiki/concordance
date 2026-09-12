---
"@concordance-wiki/site": minor
"@concordance-wiki/cli": minor
---

Component gallery: `concordance gallery [--output dir] [--theme plugin] [--config file]` renders every slot with fixture view models into a static page set, an index naming the plugin and theme behind every overridden slot, the island bundles and the stylesheet next to the pages, and fails on a page over budget or on an accessibility finding; the site package ships the fixtures (`galleryFixtures`), the page set (`galleryPages`), `buildGallery`, `renderDocument` and a static accessibility checker (`checkAccessibility`) with nine structural rules that the site tests run on every gallery page.
