---
"@concordance-wiki/core": minor
"@concordance-wiki/profile": patch
"@concordance-wiki/nlp": patch
---

Every published schema is read and compiled once per process (`compiledSchema` in the core package) and its validator shared: reading the thirty-five type modules of the default profile takes a seventh of the time, validating a configuration a fifth, and every command starts faster; `readSchema` returns the same schema object on every call.
