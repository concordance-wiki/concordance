---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
---

Serialised canonical model: `assembleModel` puts the build block, the entities, the links with their provenances, the findings and the candidates in canonical order, `serializeModel` writes them as canonical JSON, `parseModel` and `validateModel` check a model against the published `model.schema.json` (which now requires the entity locale and source line, closes the provenance objects and records the URL of a git source), and `toCypher` exports the graph as a Cypher script; `concordance build` loads the profile, types the notes, resolves the written links, writes `dist/model.json` next to the log and counts entities per type and links per method in the summary, and `concordance export --format cypher` writes the Cypher script of a model.
