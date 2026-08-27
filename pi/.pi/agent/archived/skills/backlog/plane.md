# Publishing to Plane

Toutes les opérations utilisent les outils `plane_*` disponibles dans pi.
Rien ici ne s'exécute avant que l'utilisateur n'ait approuvé le breakdown.

## Notes sur les outils pi vs Claude

Les outils Plane de pi couvrent le CRUD de base mais n'ont pas :
- `create_work_item_relation` → pas de `blocked_by` natif possible
- `list_work_item_types` / `resolve_work_item_type` → pas de notion de type
- `create_page` / `attach_page_to_work_item` → pas de pages attachées

**Conséquence** : les épiques sont des work items standards avec `priority:
"urgent"`, et les tickets s'y rattachent via `parentId`. Les dépendances
`blocked_by` sont documentées dans le corps HTML uniquement.

## 1. Création

Dans l'ordre des dépendances : épiques d'abord, puis tickets, en commençant
par ceux qui n'ont pas de bloqueurs.

```js
plane_create_workitem({
  projectId: "<uuid>",
  name: "<outcome sentence>",
  parentId: "<epic uuid, pour les tickets>",
  description: "<div>…</div>",  // HTML converti depuis le template
  priority: "urgent|high|medium|low|none",
})
```

Règles pour `description` (texte converti en HTML par pi) :
- En-têtes en `###` markdown
- Listes en `- ` markdown
- Code en `` ` ``
- **Pas de HTML brut** — pi convertit le plain text en HTML

Priority : épiques `urgent` quand rien ne ship sans elles, sinon `high`.
Tickets `high` pour le chemin critique, `medium` par défaut, `low` pour polish.

Ne pas assigner, ne pas setter de dates. Laisser le state par défaut (Backlog).

## 2. Read back

- `plane_list_workitems(projectId=<uuid>)` — vérifier que le compte correspond.
- `plane_get_workitem("<PROJ-42>")` — confirmer que le body rend correctement.

Rapporter : identifiants des épiques avec leurs titres, nombre de tickets par
épique, la frontier (tickets sans bloqueurs, prêts à démarrer).

## 3. Labels

Optionnels et désactivés par défaut. Si l'utilisateur veut un marqueur
agent-grabbable, créer un label via l'UI Plane — les outils pi ne permettent
pas de créer des labels.

## Never

- Modifier ou fermer un epic/ticket existant que tu n'as pas créé dans ce run.
- Coller une spec entière dans une description de work item.
- Créer des work items avant que le breakdown soit approuvé.