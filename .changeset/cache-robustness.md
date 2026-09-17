---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": patch
"@concordance-wiki/plugin-convert-libreoffice": patch
"@concordance-wiki/plugin-contract-openapi": patch
"@concordance-wiki/plugin-contract-wsdl": patch
---

The caches survive an interrupted build: the node file system writes next to the destination and renames, so a file is whole or absent; a text representation or a cached contract that is not JSON reads as absent and is extracted again (the build reports a text representation it cannot read, instead of stopping on the raw error); a contract reader declares the `cacheVersion` of the shape it extracts, and a contract cached under another version is read again; the work folder of a conversion is removed whatever happened in it.
