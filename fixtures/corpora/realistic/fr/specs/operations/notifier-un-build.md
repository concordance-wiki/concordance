---
method: POST
path: /notifyBuild
api: api/pont-de-forge
operation_id: notifyBuild
---
# Notifier un build

Indique au pont qu'un pipeline de forge a terminé un lint et lui transmet l'identifiant du [build](../objets/build.md). Refuse un build qui a échoué selon la politique fail-on.

## Règles

- [Politique fail-on](../regles/politique-fail-on.regle.md)
