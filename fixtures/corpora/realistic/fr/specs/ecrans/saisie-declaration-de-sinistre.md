---
roles: [roles/gestionnaire, roles/gestionnaire-sinistres]
reads: [objets/contrat, objets/garantie]
writes: [objets/sinistre]
url_pattern: /contrats/:id/sinistres/nouveau
---
# Saisie de déclaration de sinistre

Enregistre une déclaration de sinistre reçue en agence : la date de l'événement, la garantie concernée et une description. L'[API Sinistres](../api/sinistres.md) ouvre le dossier sinistre et contrôle le [délai de déclaration](../regles/delai-de-declaration-sinistre.regle.md).

## Objets

- Lit : [contrat](../objets/contrat.md), [garantie](../objets/garantie.md)
- Écrit : [sinistre](../objets/sinistre.md)

## Actions

1. Soumettre → [instruction du sinistre](instruction-sinistre.md)
2. Annuler → [fiche adhérent](fiche-adherent.md)

## Règles

- [Délai de déclaration du sinistre](../regles/delai-de-declaration-sinistre.regle.md)
