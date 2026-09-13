---
schedule: "0 5 1 * *"
window: 05:00-06:00
depends_on: [batches/nightly-build]
---
# Staleness report

Lists the notes untouched for 180 days, raises one finding per stale note and hands the list to the to-do page. Runs after the [nightly build](nightly-build.md) and reads the [Canonical model API](../api/canonical-model.md) rather than the sources.

## Reads

- [Entity](../objects/entity.md)
- [ENTITIES table](../tables/entities.table.md)

## Writes

- [FINDINGS table](../tables/findings.table.md)
