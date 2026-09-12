# E-TYPE-CONFLICT

**Severity:** error. **Family:** identifiers and types.

The frontmatter `type` contradicts the type given by the file suffix.

A suffix such as `.rule.md` is a typing convention of the source. A frontmatter that says otherwise leaves the reader and the tool unsure which one to trust.

## Before

```
---
type: screen
---
# Annual cap
(file: rules/annual-cap.rule.md)
```

## After

```
---
type: rule
---
# Annual cap
(file: rules/annual-cap.rule.md)
```

## How to fix

Align the frontmatter with the suffix, or drop the frontmatter `type` and let the convention decide.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
