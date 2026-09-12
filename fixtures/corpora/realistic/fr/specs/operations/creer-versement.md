---
method: POST
path: /versements
api: api/versements
operation_id: createPayment
---
# Créer un versement

Contrôle les plafonds avant de créer le [versement](../objets/versement.md). Refuse avec un 409 et le motif, que l'écran affiche tel quel.

## Consommateurs

- [Saisie de versement libre](../ecrans/saisie-versement-libre.md)
- [Paiement en ligne](../ecrans/portail/paiement-en-ligne.md)

## Règles

- [Plafond annuel](../regles/plafond-annuel.regle.md)
- [Plafond mensuel](../regles/plafond-mensuel.regle.md)
