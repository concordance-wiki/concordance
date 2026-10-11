---
"@concordance-wiki/cli": patch
---

The command line opens its standard input only for `concordance mcp`, which reads it. Every other command exits when its work is done, even when the program that started it leaves that input open.
