---
"@concordance-wiki/core": minor
"@concordance-wiki/ingest": minor
---

Parse markdown and frontmatter: `parseMarkdown` extracts the title, H2 sections with their text and list items, links with line and column, images, code blocks, block quotes, tables and paragraphs from CommonMark and GFM, and reports a broken YAML frontmatter as `E-FM-INVALID` while still processing the body; `resolveLink` resolves a target against the file, then against the source root, keeping its anchor; `readMarkdown` decodes a file as strict UTF-8 and reports `E-ENCODING` when it is not; `FileSystem` gains `readBytes`.
