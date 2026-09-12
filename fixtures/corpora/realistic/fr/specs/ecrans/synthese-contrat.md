---
roles: [roles/gestionnaire, roles/responsable-d-agence]
reads: [objets/contrat, objets/garantie, objets/beneficiaire, objets/versement]
writes: [objets/avenant]
url_pattern: /contrats/:id
---
# Synthèse du contrat

Affiche un contrat avec ses garanties, sa clause bénéficiaire, son solde et ses derniers versements. Un avenant se saisit depuis cet écran ; la date d'effet de chaque garantie est affichée à côté d'elle.

## Objets

- Lit : [contrat](../objets/contrat.md), [garantie](../objets/garantie.md), [bénéficiaire](../objets/beneficiaire.md), [versement](../objets/versement.md)
- Écrit : [avenant](../objets/avenant.md)

## Actions

1. Enregistrer un versement → [saisie de versement libre](saisie-versement-libre.md)
2. Résilier → [demande de résiliation](demande-de-resiliation.md)
3. Retour → [fiche adhérent](fiche-adherent.md)

## Règles

- [Désignation du bénéficiaire](../regles/designation-du-beneficiaire.regle.md)
- [Préavis de renouvellement](../regles/preavis-de-renouvellement.regle.md)
