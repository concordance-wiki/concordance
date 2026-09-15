---
"@concordance-wiki/site": patch
"@concordance-wiki/i18n": patch
---

The results page as served no longer announces "0 results": its status region says that the search runs in the browser and needs JavaScript, a sentence of the message catalogue (`results.noScript`) the island replaces once it mounts. The writing direction of a page now comes from the locale's script through `textDirection` of the i18n package, so that Pashto, Sorani or Divehi pages read right to left like Arabic, Hebrew, Persian and Urdu ones.
