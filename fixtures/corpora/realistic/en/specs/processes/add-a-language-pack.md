---
execution: human
triggers: [new locale requested]
---
# Add a language pack

A maintainer teaches the recognition step a new locale.

## Steps

1. The [maintainer](../roles/maintainer.md) writes the pack: stopwords, plural endings, accent folding and type prefixes.
2. The dictionary is rebuilt on a corpus of that locale and the occurrences are compared with a reviewed list.
   - If an alias is missed, go to step 1.
3. The pack is registered under its BCP 47 tag.
4. End.
