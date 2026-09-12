# W-CONV-SUSPECT

**Severity:** warning. **Family:** documents.

A converted PDF contains no extractable text although the document is large.

The document is probably made of images or is protected. Its preview works but nothing of it enters the search index or the occurrence scan.

## Before

```
framing/scope-v3.pdf  (42 pages, 0 characters extracted)
```

## After

```
framing/scope-v3.pdf  (42 pages, 18,400 characters extracted)
```

## How to fix

Re-export the document with selectable text, or add a markdown twin that carries its content.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
