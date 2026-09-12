---
roles: [roles/gestionnaire, roles/gestionnaire-sinistres]
reads: [objets/adherent, objets/contrat]
url_pattern: /adherents
---
# Recherche adhérent

Retrouve un adhérent par son nom, son numéro d'adhérent ou un numéro de contrat. Point d'entrée de tout parcours en agence : un versement, une déclaration de sinistre ou une résiliation commence ici.

## Objets

- Lit : [adhérent](../objets/adherent.md), [contrat](../objets/contrat.md)

## Actions

1. Ouvrir → [fiche adhérent](fiche-adherent.md)
2. Nouveau contrat → [synthèse du contrat](synthese-contrat.md)
