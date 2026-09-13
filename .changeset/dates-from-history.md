---
"@concordance-wiki/core": minor
"@concordance-wiki/ingest": minor
---

Git sources are cloned with their whole history and without the blobs (`--filter=blob:none`, a clone an earlier version left shallow is completed on update), so that every file carries the date of the last commit that touched it rather than the date of the head; a local `path` source inside a git repository takes the same dates from that repository for the files unchanged since their commit, through the new optional `localHistory` of `GitClient`.
