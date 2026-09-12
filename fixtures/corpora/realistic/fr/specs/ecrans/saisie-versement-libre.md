---
roles: [roles/gestionnaire]
reads: [objets/contrat, objets/adherent]
writes: [objets/versement]
url_pattern: /contrats/:id/verser
---
# Saisie de versement libre

Permet à un gestionnaire d'enregistrer un versement libre sur un contrat en cours, à la demande de l'adhérent. Le montant est contrôlé contre le [plafond annuel](../regles/plafond-annuel.regle.md) et le [plafond mensuel](../regles/plafond-mensuel.regle.md) par l'[API Versements](../api/versements.md) ; l'écran affiche le message renvoyé et ne recalcule jamais un plafond.

Les versements exceptionnels ne se saisissent pas ici : ils sont traités manuellement en agence.

## Objets

- Lit : [contrat](../objets/contrat.md), [adhérent](../objets/adherent.md)
- Écrit : [versement](../objets/versement.md)

## Actions

1. Valider → [récapitulatif de versement](recapitulatif-versement.md)
2. Annuler → [recherche adhérent](recherche-adherent.md)

## Règles

- [Plafond annuel](../regles/plafond-annuel.regle.md)
- [Plafond mensuel](../regles/plafond-mensuel.regle.md)
- [Mandat de prélèvement obligatoire](../regles/mandat-de-prelevement-obligatoire.regle.md)
