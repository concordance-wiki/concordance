# @concordance-wiki/ui

## 1.0.0

### Major Changes

- eabcdc1: Concordance 1.0.0 is published under the MIT licence; the versions published before it stay under the GNU General Public License, version 3 or later. From this version on, the configuration schema, the plugin API, the format of `model.json`, the command line and the text answer of `query` follow semantic versioning: a change that breaks one of them waits for a major version.

## 0.4.0

No changes in this release.

## 0.3.1

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.0

### Patch Changes

- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.

## 0.1.0

### Minor Changes

- cc77d53: Create the packages with their entry points and the build toolchain.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
