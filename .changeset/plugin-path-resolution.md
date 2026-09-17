---
"@concordance-wiki/core": patch
"@concordance-wiki/cli": patch
---

A plugin declared by a path (`./plugins/theme/index.js`) is resolved against the folder of the configuration file by every command: `build` imported the path as written and failed where `render` succeeded, and `render`, `init --templates` and `gallery` resolved it against the working directory.
