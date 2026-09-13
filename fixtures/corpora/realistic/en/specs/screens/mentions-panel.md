---
roles: [roles/author]
reads: [objects/entity, objects/link, objects/occurrence]
url_pattern: /entities/:id/mentions
---
# Mentions panel

Where the author sees every mention of an entity: the file, the line, the method that found it and the confidence it earned. An occurrence inside a code block is not listed, since the scan discards it.

## Objects

- Reads: [link](../objects/link.md), [occurrence](../objects/occurrence.md)

## Actions

1. Back → [entity page](entity-page.md)

## Rules

- [Section heading match](../rules/section-heading-match.rule.md)
