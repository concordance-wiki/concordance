---
"@concordance-wiki/core": minor
"@concordance-wiki/site": patch
"@concordance-wiki/plugin-convert-libreoffice": patch
---

The validation refuses a source named after a folder the site reserves (`about`, `assets`, `fragments`, `index`, `keywords`, `search`, `spaces`, `todo`; `RESERVED_SOURCE_NAMES` in the core package), and the assembly of the site fails on two documents at one path instead of writing one over the other; LibreOffice is an optional dependency of its plugin, so that a PDF source is still read without it and an office document gets a finding naming the missing command instead of a silent loss.
