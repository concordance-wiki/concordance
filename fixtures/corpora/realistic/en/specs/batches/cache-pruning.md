---
schedule: "0 4 * * 1-5"
window: 04:00-04:30
depends_on: [batches/nightly-build]
---
# Cache pruning

Removes from the fingerprint cache the entries no resource of the last build used. A cold start converts every document again, which takes an hour on a large corpus; the pruning never forces a cold start, since it keeps every entry the last build touched. Runs on working days after the [nightly build](nightly-build.md).

## Reads

- [Resource](../objects/resource.md)
- [Build](../objects/build.md)
