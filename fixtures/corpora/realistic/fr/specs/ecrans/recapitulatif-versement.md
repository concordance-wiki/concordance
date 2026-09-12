---
roles: [roles/gestionnaire]
reads: [objets/versement, objets/contrat]
url_pattern: /contrats/:id/versements/:versementId
---
# Récapitulatif de versement

Affiche le versement qui vient d'être saisi avec sa date de valeur. Le solde du contrat n'est mis à jour qu'après le [règlement nocturne](../batchs/reglement-nocturne.md), ce que l'écran indique explicitement.

## Objets

- Lit : [versement](../objets/versement.md), [contrat](../objets/contrat.md)

## Actions

1. Retour au contrat → [synthèse du contrat](synthese-contrat.md)
