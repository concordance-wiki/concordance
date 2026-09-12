---
"@concordance-wiki/ingest": minor
"@concordance-wiki/nlp": minor
---

Zones excluded from recognition: `scannableText` reduces a parsed markdown document to the text units a scan may read (headings, paragraphs, list items, table cells and quoted paragraphs, each with its line and enclosing section), leaving out fenced and indented code blocks, inline code, URLs, raw HTML, frontmatter, images and link targets while keeping the visible text of links, and the occurrence scan is verified to yield no occurrence for a term present only in a code block.
