# E-LINK-BROKEN

**Severity:** error. **Family:** links.

A markdown link points to a file that does not exist in the source.

The link is not recorded and the reader lands on nothing. The broken target is often a renamed file.

## Before

```
# Free payment entry

The amount is checked against the [annual cap](../rules/anual-cap.rule.md).
```

## After

```
# Free payment entry

The amount is checked against the [annual cap](../rules/annual-cap.rule.md).
```

## How to fix

Fix the path. `concordance lint --fix` rewrites the link when exactly one file matches the old name.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
