---
"@concordance-wiki/inference": minor
"@concordance-wiki/checks": minor
---

Frontmatter references: `frontmatterLinks` turns every value of a reference-typed attribute that carries a relation in the profile into a link of that relation at the `frontmatter_ref` confidence, with the attributes the profile declares (`accesses` in `read` mode for `reads`), reversed for `inverse` attributes and with the attribute name as provenance; `resolveReference` and `indexEntities` resolve a value by identifier, by source-relative path, then by exact title; a value that matches nothing, several titles, a note of a type the attribute does not accept or a value that is not a string is reported as `W-REF-UNRESOLVED`, which the checks catalogue registers.
