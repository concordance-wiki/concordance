# @concordance-wiki/profile

Profile loading, validation and merge; the allowed relation matrix.

Ships the default profile (`default.yaml`), the reference meta-model: types, relations with their allowed pairs, confidence scale and type prefixes per locale.

Today: `loadDefaultProfile` reads, validates and freezes the embedded profile; `parseProfile` and `validateProfile` check a document against the schema and report every problem with its path, the value received and the values expected; `mergeProfiles` layers a project profile on top of another, key by key (arrays replaced, `allowed` pairs added); `fingerprintProfile` hashes a profile canonically; `resolveProfile` chains all of that for a build. `allowedRelations` and `singleRelation` answer the relation matrix for a pair of types.

Part of [Concordance](../../README.md).
