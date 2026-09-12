# E-META-REL

**Severity:** error. **Family:** identifiers and types.

A declared relation is not allowed between these two types by the profile.

The profile lists, for each relation, the pairs of types it may join. A frontmatter reference or a mapped section that produces a relation outside that matrix is dropped from the model.

## Before

```
---
reads: [glossary/keyword-page]
---
# Entity page
(a screen cannot `accesses` a term)
```

## After

```
---
reads: [objects/entity]
---
# Entity page
```

## How to fix

Point the reference at an entity of an allowed type, or extend the profile's `allowed` pairs for that relation.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
