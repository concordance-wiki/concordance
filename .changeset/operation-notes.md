---
"@concordance-wiki/inference": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/core": minor
---

Operation notes: `attachOperations` matches every hand-written `endpoint` note to an operation imported from the contract of its API, on the frontmatter `operation_id`, then on the `method` and `path` pair (or `port` and title for SOAP), then on the title in comparison form, and merges the pair into the note, which keeps its identifier, markdown and frontmatter, takes the contract attributes it does not set, lists the contract as a representation and names the rung in `grouped_by` while the `exposes` link now points at the note; an ambiguous match is a `W-OPERATION-AMBIGUOUS` finding and attaches nothing. Entity representations gain the optional `kind` and `operation` fields.
