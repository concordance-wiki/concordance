---
"@concordance-wiki/cli": minor
"@concordance-wiki/core": minor
---

`concordance query <expression>` prints what the model knows about an expression, without the site: the note it names, resolved as the recognition reads it (identifier, title or alias, normalised form, prefix; a term wins among candidates), where it is used with file, line and context, what it is linked to with relation, confidence and methods, and the decisions and sessions among those links; `--format json` follows the new `query.schema.json`.
