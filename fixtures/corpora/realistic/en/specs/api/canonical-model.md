---
protocol: rest
exposure: direct
version: "1"
---
# Canonical model API

The `model.json` file every build writes: entities, links, findings and keyword pages, read by the site and by the exporters. The only place where the [publication threshold](../rules/publication-threshold.rule.md) and the [related relation cap](../rules/related-relation-cap.rule.md) are applied, as decided in [threshold applied in model](../../decisions/threshold-applied-in-model.md). No contract: the file is the contract.

## Consumers

- [Home page](../screens/home-page.md)
- [Entity page](../screens/entity-page.md)
- [Keyword page](../screens/keyword-page.md)
- [Staleness report](../batches/staleness-report.md)
- [Build pipeline](../processes/build-pipeline.md)

## Objects

- [Entity](../objects/entity.md)
- [Link](../objects/link.md)
- [Keyword page](../objects/keyword-page.md)
