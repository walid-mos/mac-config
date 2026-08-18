---
name: accor-feedback
description: Trie les commentaires de review reçus sur mes PR (« regarde les retours sur la 130 et la 133 ») — écarte les remarques non pertinentes, applique les micro-fixes inertes, propose les patchs à valider, et liste les vraies demandes à traiter. Trigger on /accor-feedback, « les retours sur ma PR », « traite les commentaires de review », « qu'est-ce que Corentin a demandé sur la 132 ».
---

# accor-feedback

Entrée : un ou plusieurs numéros de PR (mes PR). Sortie : un tableau par PR triant les
commentaires reçus — vraies demandes, patchs à valider, autofixés, refusés, caducs,
questions — et les diffs et réponses en blocs sous les tableaux.
Seuls les micro-fixes inertes atterrissent dans le working tree sans demander ; tout
le reste est proposé et attend un « ok ».

Le skill `accor` s'applique (branches, commits, baseline, zéro commentaire narratif).
Repo par défaut : celui du cwd ; hors repo, `--repo accor-hotels/product-data-apps`.

## 1. Collecte

Par PR, un appel GraphQL qui porte les threads, leur état de résolution et les
réponses déjà postées :

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$pr:Int!){
 repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
  reviewThreads(first:100){ nodes{
   id isResolved isOutdated path line
   comments(first:20){ nodes{ databaseId author{login} body diffHunk createdAt } } } } } } }
' -F owner=accor-hotels -F repo=product-data-apps -F pr=<n> > threads-<n>.json
```

Puis les commentaires de PR hors ligne de code et les corps de review :

```bash
gh pr view <n> --json number,title,headRefName,baseRefName,url,comments
gh api repos/:owner/:repo/pulls/<n>/reviews --jq '.[] | select(.body != "") | {user: .user.login, state, body}'
```

Écarter d'office : threads `isResolved`, et threads dont le dernier commentaire est de
moi (déjà répondu). Garder les `isOutdated` mais les signaler — le code a bougé, la
remarque peut être caduque.

Distinguer les auteurs : `AccorCorentin` (ou tout humain) = review d'équipe ;
`Copilot`/`github-actions` = bot, même grille de tri mais poids moindre en cas de doute.

## 2. Vérification avant tri

Ne jamais trier sur le seul texte du commentaire. Pour chaque thread, lire le code
**actuel** au chemin/ligne visé (le `diffHunk` est un instantané, pas l'état du fichier).
Un commentaire dont la cause a disparu part en « caduc », pas en « vraie demande ».

## 3. Grille de tri

| Paquet | Critère |
| --- | --- |
| **Refusé** | Techniquement faux, repose sur une lecture erronée du code, contredit une convention du repo (FSD, Clean Arch, RTK, zéro commentaire, conventions `@astore/*`), demande un changement hors périmètre de la PR (→ ticket séparé), ou est une pure préférence sans gain. |
| **Caduc** | Déjà corrigé dans un commit ultérieur, ou `isOutdated` avec la cause disparue. |
| **Autofix** | Micro-changement strictement inerte, appliqué sans demander. Liste fermée : typo, wording/clé de trad, message d'erreur, suppression d'un commentaire narratif, import ou type inutilisé, `const` manquant, ordre de props ou de clés. Diff ≤ ~5 lignes, un seul fichier, zéro effet sur le comportement, rien à relire pour comprendre le fix. |
| **Patch à valider** | Tout le reste des changements petits mais non inertes : renommage d'un symbole, extraction d'une constante ou d'un helper, réécriture d'une condition, changement d'un défaut. Le patch est **préparé et montré**, jamais appliqué avant accord — y compris quand la remarque est un `[NIT]` ou un `[SUGGESTION]`. |
| **Vraie demande** | Change le comportement, la structure ou le contrat : bug réel, invariant cassé, refacto de découpage, ajout de test, changement d'API/de schéma, sécurité. Y compris quand la remarque est courte : c'est l'impact qui classe, pas la longueur. |
| **Question** | Attend une réponse, pas un patch. |

Règles de bord :

- **Le doute descend d'un cran** : autofix → patch à valider → vraie demande. Jamais
  l'inverse. Un changement que l'utilisateur n'a pas vu ne part pas dans le working tree.
- La classe du commentaire ne décide pas : un `[NIT]` ou un `[SUGGESTION]` qui touche
  autre chose que la liste fermée passe en patch à valider.
- Un `[BLOCKING]` n'est jamais autofixé, même trivial : vraie demande (ou refusé,
  argumenté).
- Un `[NIT]` peut être refusé comme n'importe quel autre.

## 4. Application

Seul le paquet **autofix** touche les fichiers. Les patchs à valider sont montrés en
diff dans un bloc de détail (§5.3) et appliqués seulement sur un « ok » de l'utilisateur
— un accord porte sur les réfs qu'il désigne, pas sur les suivantes.

- Vérifier d'abord la branche : `git branch --show-current` doit valoir le `headRefName`
  de la PR. Sinon, **demander** — ne jamais checkout ni changer de worktree tout seul.
- Plusieurs PR d'un même stack : n'autofixer que la PR sur laquelle on est ; annoncer
  les autres comme « en attente de la bonne branche ».
- Appliquer, puis baseline : `pnpm typecheck && pnpm lint && pnpm test`. Rouge → annuler
  le fix concerné et le remonter en vraie demande.
- Commits atomiques Conventional Commits, un par thème (pas un par commentaire) :
  `fix(menu-compliance): …`, `refactor(api): …`. Ne pas pousser sans accord explicite.

## 5. Sortie

La sortie est **un tableau par PR**, un thread par ligne, plus les blocs de détail
(diffs, réponses) rejetés dessous. Jamais de diff ni de paragraphe dans une cellule :
le tableau porte le tri, les blocs portent le contenu.

### 5.1 Récapitulatif (≥ 2 PR seulement)

| PR | Titre court | Branche | Dem. | Patch | Auto | Ref. | Autre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #129 | settings api | `feat/DA-179-settings-api` | 1 | 1 | — | — | — |
| #130 | settings tab | `feat/DA-179-settings-tab` | 1 | 1 | — | — | — |
| #132 | pages 403/404 | `feat/…-error-screen-shell` | — | — | — | — | approuvée |

Zéro thread ou PR approuvée : une ligne dans ce tableau, pas de section dédiée.

### 5.2 Un tableau par PR

Chaque PR ouvre sur un titre de niveau 2 — numéro puis titre réel de la PR :

```markdown
## #130 — feat(menu-compliance): DA-179 — referential settings tab
```

| Réf | Verdict | Emplacement | Remarque | Action |
| --- | --- | --- | --- | --- |
| 130.1 | Demande | `entities/settings/api/index.ts:91` | [BLOCKING, Corentin] le rollback restaure tout le snapshot de cache | Confirmé — rollback ciblé sur la cellule éditée → 130.1 |
| 130.2 | Patch | `widgets/settings-panel/ui/ThresholdCard.tsx:21` | [SUGGESTION, Corentin] `draft` jamais remis à zéro au changement de workspace | Confirmé — patch prêt → 130.2 |
| 130.3 | Refusé | `widgets/…/CategoryList.tsx:44` | [NIT, Corentin] extraire un sous-composant | 30 lignes, un seul appelant — réponse → 130.3 |

Règles de remplissage, dans l'ordre des colonnes :

- **Réf** : `<pr>.<index>`, index dans l'ordre du tableau. C'est la clé que
  l'utilisateur cite pour accorder (« ok 130.2 ») — ne jamais la réutiliser ni la
  renuméroter entre deux tours.
- **Verdict** : un mot exact — `Demande`, `Patch`, `Autofix`, `Refusé`, `Caduc`,
  `Question`. Trier les lignes dans cet ordre.
- **Emplacement** : `chemin:ligne` en backticks, amputé du préfixe applicatif
  (`apps/<app>/src/`, `apps/api/src/`) ; élider le milieu en `…/` au-delà de trois
  segments. Thread `isOutdated` : suffixer ` (outdated)`.
- **Remarque** : `[tag, auteur]` conservés tels quels, puis le fait reproché en une
  proposition. Pas de citation intégrale du commentaire.
- **Action** : le verdict de vérification (`Confirmé`, `Confirmé, gravité moindre`,
  `Faux`, `Déjà corrigé en <sha>`) puis la suite, en une proposition. Renvoyer vers un
  bloc de détail par `→ <réf>` quand il en existe un.

Une cellule tient sur une ligne courte : viser ≤ 80 caractères, jamais de retour à la
ligne ni de puce dedans. Ce qui déborde descend en bloc de détail.

### 5.3 Blocs de détail

Sous chaque tableau, un bloc par ligne qui a besoin de plus qu'une cellule — dans
l'ordre des réfs. Un bloc porte au choix : le raisonnement de vérification quand il
n'est pas évident, le diff prêt à appliquer, la réponse proposée pour un refusé, la
nuance qui corrige le reviewer.

Chaque bloc s'ouvre sur un **titre de niveau 3**, jamais sur une ligne de texte ni un
bloc de code : la réf, puis le sujet en trois à six mots. Le titre doit se repérer au
défilement, c'est le point d'ancrage que l'utilisateur cite. Un séparateur `---` entre
deux blocs quand ils s'enchaînent.

```markdown
### 130.2 — ThresholdCard : draft persistant au switch de workspace
```

Rendu attendu du bloc complet :

> ### 130.2 — ThresholdCard : draft persistant au switch de workspace
>
> `draft` survit entre `commit()` et `onSettled`, donc `value = draft ?? thresholdPercent`
> affiche la valeur de A sur la carte de B.
>
> ```diff
> -import { useState } from 'react'
> +import { useEffect, useState } from 'react'
> @@
>      const [draft, setDraft] = useState<number | null>(null)
> +    useEffect(() => setDraft(null), [workspace.workspaceId])
> ```

La colonne Action du tableau renvoie vers ce titre par `→ 130.2`.

Une ligne `Autofix` ou `Caduc` n'a normalement pas de bloc : le tableau suffit. Une
ligne `Demande` en a un dès que la correction demande une esquisse de code ou un
arbitrage. Une trouvaille faite en vérifiant mais absente de la review va dans le bloc
de la ligne concernée, marquée « hors remarque », et n'ouvre pas de ligne à elle.

### 5.4 Clôture

Après le dernier tableau, deux à quatre phrases : le compte par verdict tous PR
confondus, ce qui a réellement touché le working tree, ce qui est bloqué par la branche
courante, et la question de suite (quels patchs appliquer, sur quelle branche basculer).

## 6. Réponses et résolution

Proposer, ne pas poster. Rédiger en anglais (charte du repo), ton factuel, une raison
concrète — surtout pour les refusés, où le silence passe mal. Poster seulement après
accord :

```bash
gh api repos/:owner/:repo/pulls/<n>/comments/<databaseId>/replies -f body='<réponse>'
```

Résoudre un thread traité (id du thread, pas du commentaire) :

```bash
gh api graphql -f query='mutation($t:ID!){ resolveReviewThread(input:{threadId:$t}){ thread{ isResolved } } }' -F t=<threadId>
```

Ne jamais résoudre un thread dont le fix n'est ni poussé ni accepté par l'utilisateur.