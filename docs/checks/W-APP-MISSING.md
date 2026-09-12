# W-APP-MISSING

**Severity:** warning. **Family:** vocabulary and filing.

An entity resolves to no application.

The application comes from the source declaration, a typing rule or the frontmatter. Without one, the entity cannot be composed into anything. Applications and domains themselves are containers and are never reported.

## Before

```
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
```

## After

```
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: concordance-cli
```

## How to fix

Set `application` on the source, in a rule, or in the note's frontmatter.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
