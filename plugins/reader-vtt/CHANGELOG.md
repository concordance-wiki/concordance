# @concordance-wiki/plugin-reader-vtt

## 0.4.0

### Patch Changes

- 7953b7d: A path segment with no letter or digit left (a name in another script, an emoji) is named after a stable hash instead of an empty slug that made the identifier invalid; the candidates of an ambiguous frontmatter reference are named in identifier order whatever the order of the entities; two cues of a transcript starting at the same instant get distinct anchors (`t-12000`, `t-12000-2`), so that every cue stays addressable.
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
- 2fe703f: Lay the page of a meeting out on the shell of the entity page: the tree of a space whose every note is dated drawn by year and month with the breadcrumb naming the month, the line reading the type, the duration (the `duration` attribute, else the last cue of the transcript) and whether the participants are pseudonymised, the representations as anchor tabs the stylesheet shows one at a time without any script, the transcript as timestamped lines naming the speaker of every cue, the callout of the decisions the model links to the meeting, and in the panel the date, the duration, the space and the grouped files with why the build grouped them, read from the duplicates block of the model. A reader unit and the pages of a fragment now carry the `speaker` of a transcript cue, the site receives `privacy.pseudonymize.enabled` as `pseudonymized`, the catalogues gain the `meeting.*` messages and `formatMonthName` names a month alone.
- c995c47: Pseudonymisation is applied by the build: the dictionary of `privacy.pseudonymize` is read and validated (`W-PRIVACY-DICTIONARY` when it is missing or malformed, an error that fails the build and withholds every transcript when pseudonymisation is enabled), every transcript is pseudonymised before typing in its cues, its metadata and the file offered for download, which readers write back through a new optional `rewrite` (implemented for VTT and SRT; `W-PRIVACY-WITHHELD` for a reader without it), the notes and documents of the scope types are replaced the same way, the real names are rejected from keyword discovery, and transcripts are withheld altogether unless `privacy.publish_transcripts` is true.
- c1a3598: Readable transcripts: the `reader-vtt` plugin parses VTT and SRT files into cues, speakers, duration and language, renders them as HTML grouped by consecutive speaker with every timecode as an addressable anchor, and returns the spoken text with the character range of every cue. A reader now receives the raw bytes of the file as `payload.bytes`.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- 55a794d: The count of the filtered related pages and the copied-address notice of the search are `<output>` elements, status regions by nature, instead of spans with a `status` role; the VTT reader leaves the language undefined when the `Language:` header is blank, and keeps an angle bracket that opens no tag in the text of a cue.
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
