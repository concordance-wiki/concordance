---
roles: []
reads: [objects/suggestion, objects/candidate]
writes: [objects/suggestion, objects/candidate]
url_pattern: /service/suggestions
---
# Suggestion review

Where a maintainer accepts or dismisses the suggestions the service drafts: a candidate to define, a link to promote, a stale note to revisit. Works on the lock file directly and writes it back.

## Objects

- Reads: [suggestion](../../objects/suggestion.md), [candidate](../../objects/candidate.md)
- Writes: [suggestion](../../objects/suggestion.md), [candidate](../../objects/candidate.md)

## Actions

1. Back → [document viewer](document-viewer.md)

## Rules

- [Rejected terms never proposed](../../rules/rejected-terms-never-proposed.rule.md)
