---
roles: [roles/quality-owner]
reads: [objects/finding, objects/build]
writes: [objects/finding]
url_pattern: /to-do
---
# To-do page

Lists the findings of the last build grouped by check and severity; the quality owner acknowledges a finding here and the author fixes it. The staleness rows come from the [staleness report](../batches/staleness-report.md) batch.

## Objects

- Reads: [finding](../objects/finding.md), [build](../objects/build.md)
- Writes: [finding](../objects/finding.md)

## Actions

1. Open the entity → [entity page](entity-page.md)
2. Back → [home page](home-page.md)

## Rules

- [Fail-on policy](../rules/fail-on-policy.rule.md)
- [Stale after 180 days](../rules/stale-after-180-days.rule.md)
