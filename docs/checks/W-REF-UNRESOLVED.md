# W-REF-UNRESOLVED

**Severity:** warning. **Family:** links.

A frontmatter reference matches no note by identifier, path or title, several notes by title, or a note of a type the attribute does not accept.

No link is recorded for that value; the other values of the attribute are unaffected. A reference-typed attribute (`reads`, `writes`, `rules`, `roles`, `consumers`, `affects`, `broader`, `business_object`, ...) is resolved by identifier (`specs/roles/reader`, or `roles/reader` within the source of the note), then by path relative to the source root (`roles/reader.md`), then by exact title after trimming, case-sensitively. A title shared by several notes resolves nothing: the finding names the candidates. A note found under a type the attribute does not accept, such as a rule under `reads`, is reported with the expected types.

## Before

```
---
roles: [roles/raeder]
reads: [Source]
---
# Entity page
```

where `roles/raeder` is misspelt and both `specs/objects/source` and `glossary/source` are titled "Source".

## After

```
---
roles: [roles/reader]
reads: [objects/source]
---
# Entity page
```

## How to fix

Write the identifier, the path relative to the source root or the exact title of an existing note of a type the attribute accepts, or remove the reference. Prefer the identifier or the path when a title is shared by several notes. A value that is neither a string nor a list of strings is reported with the value received.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
