# @concordance-wiki/ingest

Git cloning, file reading, markdown and frontmatter parsing.

Today: `ingestSources` fetches every declared source into the cache (depth-1 clone, updated when cached) or lists a local folder, applies `privacy.exclude` before anything is read, records the last commit and date of every file, and turns an unreachable source into a `W-SOURCE-UNREACHABLE` finding without stopping.

Part of [Concordance](../../README.md).
