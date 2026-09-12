# E-ID-DUP

**Severity:** error. **Family:** identifiers and types.

Two entities resolve to the same identifier.

Identifiers derive from the source name and the file path without extension or type suffix, or from a frontmatter `id`. Two files that differ only by extension or suffix, or two notes declaring the same `id`, collide. The first in canonical order is kept; the second is dropped from the model.

## Before

```
specs/rules/annual-cap.rule.md
specs/rules/annual-cap.md
```

## After

```
specs/rules/annual-cap.rule.md
```

## How to fix

Rename one of the files, or give one of them a distinct `id` in frontmatter.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
