---
schedule: "0 4 * * 1-5"
window: 04:00-04:30
depends_on: [batchs/build-nocturne]
---
# Purge du cache

Retire du cache d'empreintes les entrées qu'aucune ressource du dernier build n'a utilisées. Un démarrage à froid reconvertit chaque document, ce qui prend une heure sur un grand corpus ; la purge ne force jamais un démarrage à froid, puisqu'elle garde chaque entrée touchée par le dernier build. S'exécute les jours ouvrés après le [build nocturne](build-nocturne.md).

## Lit

- [Ressource](../objets/ressource.md)
- [Build](../objets/build.md)
