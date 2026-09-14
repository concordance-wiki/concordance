---
"@concordance-wiki/site": minor
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
---

API page: the contract viewer opens in the page as soon as its script runs, the link to the JSON view standing in until then and without JavaScript, and the download link moves to the foot of the contract block; the meta line dates the contract by the last change of its file, as the ingest dates it, the import instant only for a contract fetched from a URL; the operations table and the tree of the space list the operations in the order of the contract. The contract record of the model carries the operation names in declaration order (`operations`) and, for a contract read as a file, its `last_modified`; the pipeline hands every source plugin the dates of the ingested files (`SourcePayload.dates`).
