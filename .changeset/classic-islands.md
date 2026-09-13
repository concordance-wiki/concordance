---
"@concordance-wiki/site": patch
---

Every island is bundled as a classic script, loaded with a deferred `<script src>`, so that a page opened from the disk runs the mode switch, the trail, the mentions panel, the category list, the document island and the contributed UI components in every browser, as the search already did; only the viewer bundles, imported on demand, stay modules. `IslandEntry.classic` and `IslandBundle.classic` give way to `module`, set on the two viewer entries.
