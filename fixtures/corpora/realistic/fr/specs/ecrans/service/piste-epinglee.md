---
roles: []
reads: [objets/entite, objets/lien]
url_pattern: /service/piste
---
# Piste épinglée

Conserve les entités qu'un lecteur a épinglées de page en page, comme décidé dans [piste épinglée dans le service](../../../decisions/piste-epinglee-dans-le-service.md). L'[API Requête du modèle](../../api/requete-du-modele.md) les sert avec le même plafond de confiance que le site statique.

## Objets

- Lit : [entité](../../objets/entite.md), [lien](../../objets/lien.md)

## Actions

1. Ouvrir le document → [visionneuse de document](visionneuse-de-document.md)

## Règles

- [Plafond de la relation liée](../../regles/plafond-de-la-relation-liee.regle.md)
- [Motif d'identifiant](../../regles/motif-d-identifiant.regle.md)
