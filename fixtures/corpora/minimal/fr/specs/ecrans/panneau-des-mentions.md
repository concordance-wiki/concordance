---
roles: [roles/mainteneur]
url_pattern: /entites/:id/mentions
---
# Panneau des mentions

Permet à un mainteneur de valider un lien explicite sur un build terminé pour une entité typée. La confiance est contrôlée contre le [plafond du lien connexe](../regles/plafond-du-lien-connexe.regle.md) par l'[API Requête de modèle](../api/requete-de-modele.md) ; le panneau affiche le message renvoyé.

Le résumé de build ne s'affiche pas ici : il est imprimé à la fin du build nocturne.

## Objets

- Lit : [build](../objets/build.md), [entité](../objets/entite.md)
- Écrit : [lien](../objets/lien.md)

## Actions

1. Confirmer → [carte de voisinage](carte-de-voisinage.md)
2. Annuler → [page entité](page-entite.md)

## Règles

- [Plafond du lien connexe](../regles/plafond-du-lien-connexe.regle.md)
