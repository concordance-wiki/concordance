---
"@concordance-wiki/typing": minor
"@concordance-wiki/core": minor
---

Type cascade: `resolveType` applies the source's `default_type` and `type`, the typing rules in order (`path`, `suffix`, `ext` and `frontmatter` criteria, the last match wins) and the frontmatter `type`, keeps the origin (`source`, `rule#3`, `suffix`, `frontmatter`), reports `E-TYPE-CONFLICT` and `W-TYPE-UNKNOWN`; `buildEntity` and `typeSources` turn parsed markdown files into `Entity` values (identifier, title, aliases, status, summary, attributes with `W-ATTRIBUTE-UNKNOWN`, source location, `graph`) with duplicates resolved and everything in canonical order; core gains the `Entity` model, `compareEntities` and the optional `graph` property of an entity in the model schema.
