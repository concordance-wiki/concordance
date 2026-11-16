---
"@concordance-wiki/core": minor
"@concordance-wiki/ingest": minor
"@concordance-wiki/site": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/typing": minor
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
---

A note with several H1s, such as a document exported from a word processor whose template uses the first heading style for every section, is read one level down: each H1 heads a section, the H2s become its subsections, and the page keeps a single H1, its title, which comes from the frontmatter or the file name. A note that used a second H1 for an appendix after its title is now titled by its file name; a `title` in its frontmatter keeps the former one.

The new source key `headings: sections` reads every H1 as a section whatever their number, for a template whose only H1 is a section. A title taken from a file name reads its underscores as spaces: `Billing_rules.md` is titled "Billing rules".

The new check `W-TITLE-SHARED` warns when at least three entities of one source share a title, and names them.
