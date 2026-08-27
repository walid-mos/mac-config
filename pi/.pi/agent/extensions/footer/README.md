# Footer — architecture

`../footer.ts` reste l'unique point d'entrée découvert par pi. Le dossier
`footer/` contient des modules internes organisés par responsabilité :

- `runtime.ts` — cycle de vie de l'extension et commandes ;
- `polling-resource.ts` — abstraction générique des ressources périodiques ;
- `footer-input.ts` — projection de l'état pi vers le modèle de rendu ;
- `render.ts` — composition pure des deux lignes ;
- `git-render.ts` / `quota-render.ts` — sous-rendus purs ;
- `git-client.ts` — collecte Git et GitHub ;
- `quota-client.ts` — agrégation concurrente des clients de quotas ;
- `quota/*.ts` — un adaptateur par fournisseur et les primitives HTTP/auth ;
- `types.ts`, `style.ts`, `format.ts`, `value.ts` — modèles et primitives sans IO.

Les séquences terminal partagées avec les surfaces vivent dans
`../ui/terminal-text.ts`, unique source de vérité pour la largeur et la
troncature ANSI/OSC 8.

## Dépendances

Les dépendances vont de l'infrastructure vers les modèles et fonctions pures :
le runtime orchestre les clients et le rendu, tandis que le rendu n'effectue
aucun IO. Ajouter un fournisseur de quota consiste à créer un adaptateur dans
`quota/`, puis à le brancher dans `quota-client.ts`.
