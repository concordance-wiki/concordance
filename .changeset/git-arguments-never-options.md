---
"@concordance-wiki/core": patch
---

`sources[].git` must be an `https://`, `ssh://` or `git@` URL and `sources[].ref` never starts with a dash: git read a value starting with a dash as an option (`--upload-pack=…` ran a command on the build machine), and a local path made the build publish any repository the machine holds; the git client also ends its options before every positional, whatever the configuration says.
