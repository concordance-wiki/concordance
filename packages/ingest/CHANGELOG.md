# @concordance-wiki/ingest

## 0.1.0

### Minor Changes

- 0591795: Git sources are cloned with their whole history and without the blobs (`--filter=blob:none`, a clone an earlier version left shallow is completed on update), so that every file carries the date of the last commit that touched it rather than the date of the head; a local `path` source inside a git repository takes the same dates from that repository for the files unchanged since their commit, through the new optional `localHistory` of `GitClient`.
- 35aff55: Zones excluded from recognition: `scannableText` reduces a parsed markdown document to the text units a scan may read (headings, paragraphs, list items, table cells and quoted paragraphs, each with its line and enclosing section), leaving out fenced and indented code blocks, inline code, URLs, raw HTML, frontmatter, images and link targets while keeping the visible text of links, and the occurrence scan is verified to yield no occurrence for a term present only in a code block.
- b17e66c: Tolerate content anomalies through findings: every finding now carries a remediation; `build` parses every markdown file after ingestion, turns unreadable files and broken frontmatters into findings without stopping, writes the summary and the sorted findings to `build.log.json` under the output folder (`--output`, `build.output` or `./dist`), prints the summary, and fails only according to `build.fail_on` (`summarize`, `shouldFail` and `serializeBuildLog` in core).
- 1bbfecc: The context of an occurrence and of a discovered expression quotes the unit as written, the inline code the scan skips put back in place, so that an excerpt never shows a hole where a code span stood; the keyword page groups the passages by page, two excerpts in view per page and the rest behind a fold, six pages in view and the other files behind a disclosure, as the reference design lays them out.
- 3fb3d96: `concordance-lint.yaml` gains an `exclude` key, globs of the files of the repository that are never read, counted or reported, with the syntax of `privacy.exclude`; the file is validated against a published `lint.schema.json`, documented by a generated reference page. The files git ignores are left out the same way, every `.gitignore` of the repository being read with the rules git applies, and `concordance lint --no-gitignore` checks them anyway. The build lists the files of a source exactly as the linter does, honouring the `exclude` of the repository and its ignore files, and skips with a `W-SOURCE-UNREACHABLE` finding a source whose lint configuration is faulty; the parity test holds it on an excluded folder and an ignored file of the faulty corpora.
- 07c9269: Parse markdown and frontmatter: `parseMarkdown` extracts the title, H2 sections with their text and list items, links with line and column, images, code blocks, block quotes, tables and paragraphs from CommonMark and GFM, and reports a broken YAML frontmatter as `E-FM-INVALID` while still processing the body; `resolveLink` resolves a target against the file, then against the source root, keeping its anchor; `readMarkdown` decodes a file as strict UTF-8 and reports `E-ENCODING` when it is not; `FileSystem` gains `readBytes`.
- cc77d53: Create the packages with their entry points and the build toolchain.
- cc3beed: Fetch sources into the cache at depth 1, or update them when already cached, without ever writing into a repository; record the last commit and modification date of every file; accept local folders; apply `privacy.exclude` before reading anything; report an unreachable source as `W-SOURCE-UNREACHABLE` and go on.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- a814a6e: The file system skips `node_modules` folders as it skips `.git`, and a URL written between brackets, which the parser leaves without a position, takes the line of its paragraph instead of stopping the build or the lint.
- Updated dependencies [203133d]
- Updated dependencies [378a546]
- Updated dependencies [d910b38]
- Updated dependencies [79c8264]
- Updated dependencies [ce3bc7c]
- Updated dependencies [0591795]
- Updated dependencies [24a33f7]
- Updated dependencies [f900830]
- Updated dependencies [2d7b65d]
- Updated dependencies [af10923]
- Updated dependencies [b5f0071]
- Updated dependencies [116aca4]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [69cf231]
- Updated dependencies [ee71a72]
- Updated dependencies [e20e743]
- Updated dependencies [4154f49]
- Updated dependencies [a1c0353]
- Updated dependencies [b9e4031]
- Updated dependencies [34c5a53]
- Updated dependencies [4bd6bd7]
- Updated dependencies [b092a63]
- Updated dependencies [8ca9305]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [efb8c03]
- Updated dependencies [07c9269]
- Updated dependencies [2fe703f]
- Updated dependencies [f34c511]
- Updated dependencies [38a63c6]
- Updated dependencies [de7f8a2]
- Updated dependencies [64664a4]
- Updated dependencies [d0c0bc5]
- Updated dependencies [ef6d6fe]
- Updated dependencies [66d7b33]
- Updated dependencies [ce3f837]
- Updated dependencies [676a36a]
- Updated dependencies [c995c47]
- Updated dependencies [a5ef5ff]
- Updated dependencies [84a3d54]
- Updated dependencies [2922261]
- Updated dependencies [cc77d53]
- Updated dependencies [c5048be]
- Updated dependencies [a814a6e]
- Updated dependencies [cc3beed]
- Updated dependencies [a954edf]
- Updated dependencies [0ef98c5]
- Updated dependencies [14088cd]
- Updated dependencies [c623d60]
- Updated dependencies [1a5f84d]
- Updated dependencies [c1a3598]
- Updated dependencies [c54d224]
- Updated dependencies [223a319]
  - @concordance-wiki/core@0.1.0
