---
"@concordance-wiki/inference": minor
---

Mentions in a typed section: `mentionLinks` turns every occurrence of a note read in another note into a link, with the relation, attributes and direction of the section the profile maps for the type of the note at the `section_mention` confidence (section key and line as provenance) when the mention sits under a mapped H2 heading, and a `related` link at the base `glossary_occurrence` confidence otherwise; `mappedSection` matches a heading against the section key and every locale label of the profile without regard to case, accents or whitespace.
