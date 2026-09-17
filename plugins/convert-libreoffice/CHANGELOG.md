# @concordance-wiki/plugin-convert-libreoffice

## 0.4.0

### Patch Changes

- e5ca327: The caches survive an interrupted build: the node file system writes next to the destination and renames, so a file is whole or absent; a text representation or a cached contract that is not JSON reads as absent and is extracted again (the build reports a text representation it cannot read, instead of stopping on the raw error); a contract reader declares the `cacheVersion` of the shape it extracts, and a contract cached under another version is read again; the work folder of a conversion is removed whatever happened in it.
- a5ca382: A git source is reported unreachable only when git fails: a failure of the file system while listing or dating its files surfaces as the bug it is; two identical office documents under two paths converted in parallel share one LibreOffice run instead of one work folder, so that neither loses its PDF.
- 7359a7b: The validation refuses a source named after a folder the site reserves (`about`, `assets`, `fragments`, `index`, `keywords`, `search`, `spaces`, `todo`; `RESERVED_SOURCE_NAMES` in the core package), and the assembly of the site fails on two documents at one path instead of writing one over the other; LibreOffice is an optional dependency of its plugin, so that a PDF source is still read without it and an office document gets a finding naming the missing command instead of a silent loss.
- Updated dependencies [e5ca327]
- Updated dependencies [524f45d]
- Updated dependencies [b6a5530]
- Updated dependencies [da662fd]
- Updated dependencies [8b2155e]
- Updated dependencies [6d7208b]
- Updated dependencies [7e5a9b1]
- Updated dependencies [1f66f9f]
- Updated dependencies [4234308]
- Updated dependencies [5e137bf]
- Updated dependencies [a470bd4]
- Updated dependencies [ab7dd44]
- Updated dependencies [78f7248]
- Updated dependencies [30da51f]
- Updated dependencies [7359a7b]
- Updated dependencies [ccbf0fc]
- Updated dependencies [23d6f77]
- Updated dependencies [7953b7d]
- Updated dependencies [21ea529]
- Updated dependencies [ee74348]
- Updated dependencies [4833f68]
  - @concordance-wiki/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [6a4fcf6]
  - @concordance-wiki/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [7c56d0a]
  - @concordance-wiki/core@0.3.0

## 0.2.0

### Patch Changes

- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [0adb9b5]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
  - @concordance-wiki/core@0.2.0

## 0.1.0

### Minor Changes

- 050d8a7: Extracted text indexed: `concordance build` gains a documents step that reads every file a reader or a converter of the plugins accepts, types it as an entity (identifier with its extension, metadata as attributes, the source rules and their `ext` matches applied), converts office documents to PDF in parallel (`conversion.parallelism`, `convert: false` per source) and takes their text from the pages of that PDF only, so that there is a single extraction path; the `convert-libreoffice` plugin produces a `text` representation (`<sha256>.text.json`, one entry per page) next to every PDF and a second converter keeps `.pdf` sources as their own representation; the `reader-vtt` plugin returns `units`, one per speaker turn with its timecode, a new optional field of `ReaderOutput`; the scan, the keyword discovery and the twin reconciliation read the pages of the documents, an occurrence in a document carrying the page, slide or cue number as its line and its label as its section, so that the mentions panel cites `slide 3` or `00:12:05` instead of a line; a document that still has no markdown representation once the twins are reconciled yields `W-DOC-NOMD`; the fragment of an entity lists its `documents` with the text of every page cut at `build.extracted_text_max_chars` and joined as its `text`, and the build keeps the original file and its PDF under `fragments/<id>/` for `render` to place next to the page; a failed conversion counts for `build.fail_on.unconverted_max`.
- de7f8a2: Add the `convert-libreoffice` plugin: `.docx`, `.pptx` and `.xlsx` documents are converted to PDF through headless LibreOffice, cached by the SHA-256 of the source under the pipeline cache, run through a bounded pool that keeps the input order, with `W-CONV-FAILED` on size, timeout or failure and `W-CONV-SUSPECT` on a large document whose PDF has no extractable text. The core types the converter payload (`bytes`, `sha256`, `cacheDirectory`, limits) and output (`representations` as cache files plus `findings`), and `FileSystem` gains `writeBytes` and `remove`.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
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
