# @concordance-wiki/inference

Link production, confidence combination, relation typing, bounded neighbourhood, term candidates.

Today: explicit links (`explicitLinks`): every markdown link written in a note that resolves to another note gives a link at the `explicit_link` confidence of the profile, with the file, the line, the link text and the anchor as provenance; a link to a non-markdown file gives a `documents` link from the resource to the note; a missing target is `E-LINK-BROKEN`; a target in another source, written `<source>:<path>` or as a relative path climbing into a sibling source, resolves when `inference.cross_source_links` allows it and is `W-LINK-CROSS-SOURCE` otherwise. Links from one note to the same target are merged with every provenance kept; the relation is the single one the profile admits for the type pair, `related` until the relation typing step refines it.

Part of [Concordance](../../README.md).
