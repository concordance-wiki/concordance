---
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Build nocturne

Reconstruit le site depuis chaque source déclarée, écrit le modèle canonique et l'index de recherche, et consigne le journal de build. N'appelle rien hors des dépôts ; s'exécute même quand rien n'a changé, pour attraper une note obsolète et vérifier le déterminisme : deux builds du même arbre écrivent les mêmes octets.

## Lit

- [Source](../objets/source.md)
- [Ressource](../objets/ressource.md)

## Écrit

- [Table ENTITES](../tables/entites.table.md)
- [Table LIENS](../tables/liens.table.md)
