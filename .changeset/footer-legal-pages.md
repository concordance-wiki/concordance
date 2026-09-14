---
"@concordance-wiki/core": minor
"@concordance-wiki/i18n": minor
"@concordance-wiki/site": minor
"@concordance-wiki/cli": minor
---

The footer of every page distinguishes what the tool knows from what the organisation declares: a card in two columns, "This site" with the build instant, the repositories counted and linked to the spaces page, the generator and its licence, then "Declared by the organisation" with the legal notice, the accessibility statement and the personal data page, shown only when the new `project.legal` keys (`mentions_url`, `accessibility_url`, `accessibility_status`, `privacy_url`) or a note at `legal/<page>.md` declare them, the accessibility link carrying the declared state and nothing else, followed by the `footer.text` and `footer.links` of the theme; under the columns the build line names the profile, counts the pages and ends on the to-do link. `footer.credit` now names the tool inside the sentence of the generator. The `Footer` slot receives its strings worded on `labels`; the `footer.*` messages are rewritten; gallery states `footer-corporate` and `footer-alone`.
