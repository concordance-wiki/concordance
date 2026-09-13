---
severity: warning
condition: la jumelle la plus courte porte moins de la moitié du texte de la plus longue
---
# Ratio de taille des jumelles

Quand une note et un document converti sont appariés en jumelles, le signal de contenu de la paire est plafonné sous 0,5 si la plus courte porte moins de la moitié du texte de la plus longue. L'appariement lui-même suit [MinHash pour les ressources jumelles](../../decisions/minhash-pour-les-ressources-jumelles.md).

## S'applique à

- [Visionneuse de document](../ecrans/service/visionneuse-de-document.md)
- [Représentation](../objets/representation.md)
- [Ressource](../objets/ressource.md)
