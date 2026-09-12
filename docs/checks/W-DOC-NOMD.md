# W-DOC-NOMD

**Severity:** info. **Family:** documents.

A document has no markdown representation.

Its words are recorded from the extracted text, but nobody wrote anything about it. The to-do page lists these documents as a work list.

## Before

```
meetings/2026-03-12/support.pptx
```

## After

```
meetings/2026-03-12/support.pptx
meetings/2026-03-12/notes.md
```

## How to fix

Write a markdown note next to the document, with the same base name or a frontmatter `source:` pointing at it.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
