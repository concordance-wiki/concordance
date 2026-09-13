# W-REF-UNRESOLVED

**Severity:** warning. **Family:** links.

A frontmatter reference matches no note by identifier, path or title, or several notes by title.

No link is recorded for that value; the other values of the attribute are unaffected. A reference-typed attribute (`reads`, `writes`, `rules`, `roles`, `consumers`, `affects`, `broader`, `business_object`, ...) is resolved by identifier (`specs/roles/reader`, or `roles/reader` within the source of the note), then by path relative to the source root (`roles/reader.md`), then by exact title after trimming, case-sensitively. A title shared by several notes resolves nothing: the finding names the candidates. A note found under a type the attribute does not accept, such as a rule under `reads`, is not an unresolved reference: its link is produced and the relation typing step drops it with `E-META-REL` when the profile matrix forbids the relation between the two types.

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

Write the identifier, the path relative to the source root or the exact title of an existing note, or remove the reference. Prefer the identifier or the path when a title is shared by several notes. A value that is neither a string nor a list of strings is reported with the value received.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
