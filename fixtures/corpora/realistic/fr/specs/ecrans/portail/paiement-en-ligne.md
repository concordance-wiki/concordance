---
roles: []
reads: [objets/contrat]
writes: [objets/versement]
url_pattern: /portail/contrats/:id/payer
---
# Paiement en ligne

Permet à l'adhérent d'effectuer un versement libre depuis le portail, comme décidé dans [paiement en ligne sur le portail](../../../decisions/paiement-en-ligne-sur-le-portail.md). L'[API Versements](../../api/versements.md) applique les mêmes plafonds que l'écran d'agence.

## Objets

- Lit : [contrat](../../objets/contrat.md)
- Écrit : [versement](../../objets/versement.md)

## Actions

1. Confirmer → [mes contrats](mes-contrats.md)

## Règles

- [Plafond annuel](../../regles/plafond-annuel.regle.md)
- [Plafond mensuel](../../regles/plafond-mensuel.regle.md)
