# W-LINK-CROSS-SOURCE

**Severity:** warning. **Family:** links.

A markdown link points to a file of another source while `inference.cross_source_links` is off.

The link is not recorded. A link leaves its source either with the `<source>:<path>` prefix or with a relative path that climbs above the source root into a sibling source, as happens when several sources are folders of the same repository.

## Before

```
# Keyword page threshold review

See [static site with islands](decisions:static-site-with-islands.md).
```

with

```
inference:
  cross_source_links: false
```

## After

```
inference:
  cross_source_links: true
```

## How to fix

Set `inference.cross_source_links` to `true` in `concordance.yaml` so that links across sources resolve, or link to a note of the same source. A link that leaves the source for a file that does not exist is reported as `E-LINK-BROKEN` once cross-source links are allowed.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
