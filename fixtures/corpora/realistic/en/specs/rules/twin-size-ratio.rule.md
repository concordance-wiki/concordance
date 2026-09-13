---
severity: warning
condition: the shorter twin carries less than half the text of the longer one
---
# Twin size ratio

When a note and a converted document are paired as twins, the content signal of the pair is capped under 0.5 if the shorter carries less than half the text of the longer. The pairing itself follows [MinHash for twin resources](../../decisions/minhash-for-twin-resources.md).

## Applies to

- [Document viewer](../screens/service/document-viewer.md)
- [Representation](../objects/representation.md)
- [Resource](../objects/resource.md)
