# W-STALE

**Severity:** warning. **Family:** vocabulary and filing.

A source or a note has not changed for longer than the configured threshold.

Not produced by this version: the home page flags dormant sources with the same thresholds instead ([limits](../guides/limits.md)). The date comes from git, so it is always right. The threshold is `staleness.warn_after_days`, with a default and per-source overrides.

## Before

```
standards: last commit 193 days ago (threshold 180)
```

## After

```
staleness:
  warn_after_days: { default: 60, standards: 365 }
```

## How to fix

Review the content, mark obsolete notes `status: obsolete`, or raise the threshold for sources that legitimately change rarely.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
