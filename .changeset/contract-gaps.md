---
"@concordance-wiki/inference": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/site": minor
---

Gaps between contract and notes: `attachOperations` reports an operation note that names an API with an imported contract and matches none of its operations as `W-OPERATION-UNMATCHED`, a warning saying that the operation disappeared from the contract or that the note is ahead of it (a note that names no API, or one taken in an ambiguity, is not reported); the check joins the catalogue as a pipeline step with its documentation page; and the contract section of the `api` page flags every operation of the contract that no note describes yet, with their count in its heading.
