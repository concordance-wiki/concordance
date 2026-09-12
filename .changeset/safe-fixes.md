---
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
---

Safe automatic fixes: `concordance lint --fix` adds the type deduced from the source rules to a frontmatter that has none, orders the frontmatter keys canonically and points a link to a missing file at the only file carrying that name, announcing every change before writing and refusing an ambiguous one; `--dry-run` lists the changes without writing. The lint package exports `fixRepository`, `normalizeFrontmatter`, `rewriteRenamedLinks` and `deduceType`.
