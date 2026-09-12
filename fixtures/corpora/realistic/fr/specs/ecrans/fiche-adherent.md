---
roles: [roles/gestionnaire]
reads: [objets/adherent, objets/contrat]
writes: [objets/adherent]
url_pattern: /adherents/:id
---
# Fiche adhérent

Affiche l'adhérent, le foyer et la liste des contrats. Le gestionnaire met à jour l'adresse postale et le foyer ici ; tout ce qui concerne un contrat se fait depuis la synthèse du contrat.

## Objets

- Lit : [adhérent](../objets/adherent.md), [contrat](../objets/contrat.md)
- Écrit : [adhérent](../objets/adherent.md)

## Actions

1. Ouvrir le contrat → [synthèse du contrat](synthese-contrat.md)
2. Enregistrer un versement → [saisie de versement libre](saisie-versement-libre.md)
3. Déclarer un sinistre → [saisie de déclaration de sinistre](saisie-declaration-de-sinistre.md)

## Règles

- [Limite d'âge de l'adhérent](../regles/limite-d-age-adherent.regle.md)
