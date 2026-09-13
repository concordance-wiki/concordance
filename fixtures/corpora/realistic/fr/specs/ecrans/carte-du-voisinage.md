---
roles: [roles/auteur, roles/mainteneur]
reads: [objets/voisinage, objets/lien]
url_pattern: /entites/:id/carte
---
# Carte du voisinage

Dessine le voisinage d'une entité : les liens les plus forts d'abord, dans l'ordre que le profil donne pour le type, les liens liés en dernier et plafonnés. Un îlot : il lit le modèle et n'écrit rien.

## Objets

- Lit : [voisinage](../objets/voisinage.md), [lien](../objets/lien.md)

## Actions

1. Ouvrir une entité → [page d'entité](page-entite.md)

## Règles

- [Plafond de la relation liée](../regles/plafond-de-la-relation-liee.regle.md)
