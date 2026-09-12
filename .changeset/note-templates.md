---
"@concordance-wiki/cli": minor
---

Note templates: `concordance init --templates` copies the shipped note templates (one per active type of the default profile, their index and the example contract) into `templates/` of the configuration repository without overwriting a file, `templatesDirectory()` locates the copy the package ships, and tests verify that every template lints clean, resolves to its type through the cascade and equals `docs/templates`.
