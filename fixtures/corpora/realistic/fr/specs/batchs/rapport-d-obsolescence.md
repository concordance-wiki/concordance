---
schedule: "0 5 1 * *"
window: 05:00-06:00
depends_on: [batchs/build-nocturne]
---
# Rapport d'obsolescence

Liste les notes intouchées depuis 180 jours, lève un constat par note obsolète et transmet la liste à la page à faire. S'exécute après le [build nocturne](build-nocturne.md) et lit l'[API Modèle canonique](../api/modele-canonique.md) plutôt que les sources.

## Lit

- [Entité](../objets/entite.md)
- [Table ENTITES](../tables/entites.table.md)

## Écrit

- [Table CONSTATS](../tables/constats.table.md)
