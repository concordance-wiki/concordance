---
"@concordance-wiki/core": minor
---

Deterministic identifiers: `slugify` turns a path segment into a lowercase ASCII slug, `identifierFor` derives `<source>/<slugified path without type suffix or extension>` or takes a valid frontmatter `id` and reports an invalid one as `E-ID-INVALID`, `resolveDuplicates` keeps the first entity of each identifier in `(source, path)` order and reports the others as `E-ID-DUP`, and `pagePath` and `pageUrl` map an identifier to its `<id>/index.html` page and to root-relative or page-relative URLs.
