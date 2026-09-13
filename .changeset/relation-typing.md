---
"@concordance-wiki/inference": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/profile": minor
"@concordance-wiki/core": minor
---

Relation typing: `typeRelations` names the relation of every combined link from the profile on four rungs (mapped section, typed frontmatter attribute, type pair admitting a single relation, `related`), drops a relation the profile does not allow between the two types with `E-META-REL`, marks a pair-named link `relation_origin: pair` and turns it around when only the reverse pair admits the relation, caps `related` at the profile cap after the combination and reports one `I-REL-AMBIGUOUS` per remaining `related` link on its first provenance; `relationLabel` reads the display label of a relation, in either direction, from the profile, whose relations gain an optional `inverse_label`; the explicit link step leaves every link between two notes as `related` for that step, and `I-REL-AMBIGUOUS` becomes a step finding of the registry instead of a model check.
