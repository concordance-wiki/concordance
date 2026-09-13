---
roles: []
reads: [objets/ressource, objets/representation]
url_pattern: /service/documents/:id
---
# Visionneuse de document

Affiche un document converti à côté de la note dont il est le jumeau, via l'[API Requête du modèle](../../api/requete-du-modele.md). Le binaire d'origine n'est jamais servi : le lecteur ne voit que la représentation.

## Objets

- Lit : [ressource](../../objets/ressource.md), [représentation](../../objets/representation.md)

## Actions

1. Épingler → [piste épinglée](piste-epinglee.md)
2. Revoir les suggestions → [revue des suggestions](revue-des-suggestions.md)
