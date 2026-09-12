---
roles: [roles/gestionnaire-sinistres]
reads: [objets/sinistre, objets/garantie, objets/contrat]
writes: [objets/sinistre, objets/indemnite]
url_pattern: /sinistres/:id
---
# Instruction du sinistre

Là où le gestionnaire sinistres instruit un dossier sinistre : le rapport de l'expert est joint, la franchise est appliquée et l'indemnité est proposée. La provision affichée vient du batch de [mise à jour des provisions sinistre](../batchs/mise-a-jour-des-provisions-sinistre.md).

## Objets

- Lit : [sinistre](../objets/sinistre.md), [garantie](../objets/garantie.md), [contrat](../objets/contrat.md)
- Écrit : [sinistre](../objets/sinistre.md), [indemnité](../objets/indemnite.md)

## Actions

1. Clore avec indemnité → [récapitulatif de versement](recapitulatif-versement.md)
2. Retour → [recherche adhérent](recherche-adherent.md)

## Règles

- [Application de la franchise](../regles/application-de-la-franchise.regle.md)
