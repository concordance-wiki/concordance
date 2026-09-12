# @concordance-wiki/ingest

Git cloning, file reading, markdown and frontmatter parsing.

Today: `ingestSources` fetches every declared source into the cache (depth-1 clone, updated when cached) or lists a local folder, applies `privacy.exclude` before anything is read, records the last commit and date of every file, and turns an unreachable source into a `W-SOURCE-UNREACHABLE` finding without stopping. `readMarkdown` decodes a file as strict UTF-8 (`E-ENCODING` and the file is skipped otherwise) and `parseMarkdown` turns CommonMark and GFM into the title, the H2 sections with their text and list items, the links with line and column, the images, code blocks, block quotes, tables and paragraphs, plus the frontmatter as an untyped record (`E-FM-INVALID` when the YAML is broken; the body is still parsed). `resolveLink` resolves a link target against the file, then against the source root, and keeps its anchor.

Part of [Concordance](../../README.md).
