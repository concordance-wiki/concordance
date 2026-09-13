---
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Nightly build

Rebuilds the site from every declared source, writes the canonical model and the search index, and records the build log. Calls nothing outside the repositories; runs even when nothing changed, to catch a stale note and to check determinism: two builds of the same tree write the same bytes.

## Reads

- [Source](../objects/source.md)
- [Resource](../objects/resource.md)

## Writes

- [ENTITIES table](../tables/entities.table.md)
- [LINKS table](../tables/links.table.md)
