# E-ID-INVALID

**Severity:** error. **Family:** identifiers and types.

A frontmatter `id` does not follow the identifier pattern.

An identifier declared in frontmatter must match `^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9._-]*)+$`: a first segment of lowercase letters, digits and hyphens, then at least one more segment separated by `/`. When it does not, the declared value is ignored and the identifier derives from the source name and the file path, as if no `id` had been declared.

## Before

```
---
id: Annual Cap
---
# Annual cap
```

## After

```
---
id: specs/rules/annual-cap
---
# Annual cap
```

## How to fix

Write the `id` in lowercase with hyphens and at least one `/`, or remove the key to let the file path give the identifier.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
