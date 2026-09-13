---
application: concordance-service
protocol: rest
exposure: apim
version: "0"
contract: contrats/requete-du-modele.openapi.json
consumers: [ecrans/service/revue-des-suggestions]
---
# API Requête du modèle

Sert le modèle canonique du dernier build en HTTP, pour les écrans du service et pour les outils qui ne savent pas lire `model.json`. Rien n'en existe dans cette version. Le [contrat](contrats/requete-du-modele.openapi.json) liste trois opérations, que l'import de contrat rapproche des notes d'opération ; l'écran de revue des suggestions est déclaré consommateur alors qu'il travaille directement sur le fichier lock, ce que le contrôle de désaccord des consommateurs signale.

## Consommateurs

- [Visionneuse de document](../ecrans/service/visionneuse-de-document.md)
- [Piste épinglée](../ecrans/service/piste-epinglee.md)

## Objets

- [Entité](../objets/entite.md)
- [Lien](../objets/lien.md)
- [Constat](../objets/constat.md)
