---
schedule: "0 4 * * 1-5"
window: 04:00-04:30
depends_on: [batchs/reglement-nocturne]
---
# Mise à jour des provisions sinistre

Recalcule la provision de chaque dossier sinistre en instruction à partir de l'estimation de l'expert et de la franchise. Tourne les jours ouvrés après le [règlement nocturne](reglement-nocturne.md).

## Lit

- [Sinistre](../objets/sinistre.md)

## Écrit

- [Table SINISTRE](../tables/sinistre.table.md)
