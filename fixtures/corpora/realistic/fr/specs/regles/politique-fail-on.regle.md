---
severity: blocking
condition: un build lève une erreur, ou plus de documents non convertis que le maximum configuré
---
# Politique fail-on

Les erreurs font échouer le build ; les avertissements et les informations jamais. Un build avec plus de documents non convertis que le maximum configuré échoue aussi, pour qu'un convertisseur cassé soit remarqué avant que le site ne devienne obsolète.

## S'applique à

- [Pipeline de build](../processus/pipeline-de-build.md)
- [Lint dans une demande de fusion](../processus/lint-dans-une-demande-de-fusion.md)
- [Page à faire](../ecrans/page-a-faire.md)
