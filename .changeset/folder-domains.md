---
"@concordance-wiki/core": minor
"@concordance-wiki/typing": minor
"@concordance-wiki/checks": minor
---

Folder domains: a domain accepts `folder: true` or `folder: <name>` and claims every file with a directory of that name on its path in any source, a folder subdomain claims only the files under its parent's folder (anywhere on a path the parent's globs match when the parent is declared by globs), folders and globs combine on the same domain with the same precedence, the origin `folder` joins `frontmatter`, `glob` and `unclassified`, `validate-config` rejects a folder name that is not a single path segment, and the minimal corpus declares a `quality` domain by folder with a `determinism` folder subdomain.
