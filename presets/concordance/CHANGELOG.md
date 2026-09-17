# @concordance-wiki/concordance

## 0.4.0

### Minor Changes

- 2b05e76: The preset carries the two contract plugins, `@concordance-wiki/plugin-contract-openapi` and `@concordance-wiki/plugin-contract-wsdl`, as the guides promised: a wiki that declares them needs nothing installed next to the preset.

### Patch Changes

- f5e6dd9: The preset declares itself free of side effects, as every published package does.
- 22af32a: The README of the preset names every command of the command line.
- Updated dependencies [7863128]
- Updated dependencies [a851604]
- Updated dependencies [e5ca327]
- Updated dependencies [ea6f439]
- Updated dependencies [2f298b0]
- Updated dependencies [b6a5530]
- Updated dependencies [da662fd]
- Updated dependencies [641870f]
- Updated dependencies [4234308]
- Updated dependencies [aad2e49]
- Updated dependencies [7e7569f]
- Updated dependencies [587ea09]
- Updated dependencies [a5ca382]
- Updated dependencies [e6e4f1b]
- Updated dependencies [5e137bf]
- Updated dependencies [070a176]
- Updated dependencies [78f7248]
- Updated dependencies [fddad56]
- Updated dependencies [30da51f]
- Updated dependencies [7d4b9a5]
- Updated dependencies [2caceac]
- Updated dependencies [6c7d540]
- Updated dependencies [7359a7b]
- Updated dependencies [23d6f77]
- Updated dependencies [7953b7d]
- Updated dependencies [c09877d]
- Updated dependencies [ee74348]
- Updated dependencies [4833f68]
  - @concordance-wiki/cli@0.4.0
  - @concordance-wiki/plugin-convert-libreoffice@0.4.0
  - @concordance-wiki/plugin-contract-openapi@0.4.0
  - @concordance-wiki/plugin-contract-wsdl@0.4.0
  - @concordance-wiki/plugin-reader-office@0.4.0
  - @concordance-wiki/plugin-reader-vtt@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [6a4fcf6]
- Updated dependencies [0043442]
  - @concordance-wiki/cli@0.3.1
  - @concordance-wiki/plugin-reader-office@0.3.1
  - @concordance-wiki/plugin-convert-libreoffice@0.3.1
  - @concordance-wiki/plugin-reader-vtt@0.3.1

## 0.3.0

### Patch Changes

- @concordance-wiki/cli@0.3.0
  - @concordance-wiki/plugin-convert-libreoffice@0.3.0
  - @concordance-wiki/plugin-reader-office@0.3.0
  - @concordance-wiki/plugin-reader-vtt@0.3.0

## 0.2.0

### Patch Changes

- dbabd01: Readmes written for the registry: every package README opens with what the package is for and who installs it, the install line, the shortest example that runs against the published exports, its entry points and the guides as absolute links, the former notes kept under an Inside section; a packaging check refuses a relative link in a published README.
- e7ab68f: Package pages that say what they are for: every README on the registry opens with the mark, the package name, a one-line promise, the badges and the links, then why the package exists for the person who installs it, the quick start, what you get and the documentation; the maintainers' notes are kept at the end, folded.
- Updated dependencies [90cdb13]
- Updated dependencies [678b2f8]
- Updated dependencies [f42ff24]
- Updated dependencies [dbabd01]
- Updated dependencies [e7ab68f]
- Updated dependencies [5d2fd8c]
  - @concordance-wiki/cli@0.2.0
  - @concordance-wiki/plugin-convert-libreoffice@0.2.0
  - @concordance-wiki/plugin-reader-office@0.2.0
  - @concordance-wiki/plugin-reader-vtt@0.2.0

## 0.1.0

### Minor Changes

- 5c7f7e8: Add the `concordance` preset package, the container image built from it and the pipeline that verifies the image; the command line exposes its executable as `@concordance-wiki/cli/bin`.
- 948ae7d: The preset is published as `@concordance-wiki/concordance`: the unscoped name belongs to another package on npm. Install it with `npm install --global @concordance-wiki/concordance`; the `concordance` command and the container image keep their names.

### Patch Changes

- 38a63c6: Every published package is ready for a registry: its manifest names the repository folder it comes from, its home page and its issue tracker, the Node.js versions it supports and its public access, ships the licence next to its README and lists only its built code and the data it reads at run time; `pnpm lint` verifies that no tarball would carry tests, sources or fixtures.
- Updated dependencies [203133d]
- Updated dependencies [a0e7d01]
- Updated dependencies [79c8264]
- Updated dependencies [c9a8fbc]
- Updated dependencies [5c7f7e8]
- Updated dependencies [ce3bc7c]
- Updated dependencies [24a33f7]
- Updated dependencies [7d514b3]
- Updated dependencies [e298d7d]
- Updated dependencies [1f18480]
- Updated dependencies [af10923]
- Updated dependencies [728ca5d]
- Updated dependencies [050d8a7]
- Updated dependencies [b17e66c]
- Updated dependencies [ee71a72]
- Updated dependencies [21293ea]
- Updated dependencies [c1e8b5b]
- Updated dependencies [e20e743]
- Updated dependencies [4bf8607]
- Updated dependencies [a1c0353]
- Updated dependencies [1bbfecc]
- Updated dependencies [b9e4031]
- Updated dependencies [d5dc4b0]
- Updated dependencies [34c5a53]
- Updated dependencies [b092a63]
- Updated dependencies [8727aae]
- Updated dependencies [3fb3d96]
- Updated dependencies [cfc0835]
- Updated dependencies [3ae5687]
- Updated dependencies [efb8c03]
- Updated dependencies [2fe703f]
- Updated dependencies [5f8e108]
- Updated dependencies [2a4157b]
- Updated dependencies [38a63c6]
- Updated dependencies [de7f8a2]
- Updated dependencies [66d7b33]
- Updated dependencies [c995c47]
- Updated dependencies [2922261]
- Updated dependencies [91c3305]
- Updated dependencies [cc77d53]
- Updated dependencies [f6dea3f]
- Updated dependencies [23617d8]
- Updated dependencies [c5048be]
- Updated dependencies [cc3beed]
- Updated dependencies [55a794d]
- Updated dependencies [cbe8fcd]
- Updated dependencies [c623d60]
- Updated dependencies [1a5f84d]
- Updated dependencies [c1a3598]
- Updated dependencies [c54d224]
  - @concordance-wiki/cli@0.1.0
  - @concordance-wiki/plugin-convert-libreoffice@0.1.0
  - @concordance-wiki/plugin-reader-vtt@0.1.0
  - @concordance-wiki/plugin-reader-office@0.1.0
