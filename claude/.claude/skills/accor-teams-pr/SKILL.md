---
name: accor-teams-pr
description: Rédige le message Teams d'annonce de PR à review, à partir des seuls numéros de PR (« fais le message teams pour la 132 et la 133 »). Récupère titre, description et diff via gh, détecte les stacks, et sort le texte prêt à coller dans Teams. Trigger on /accor-teams-pr, « message teams pour les PR », « annonce ces PR », « préviens l'équipe des PR à review ».
---

# accor-teams-pr

Entrée : un ou plusieurs numéros de PR. Sortie : un bloc de texte à coller tel quel
dans Teams, dans le format exact que l'utilisateur poste depuis toujours.

## 1. Collecte

Un seul appel `gh` pour toutes les PR demandées :

```bash
for n in <numéros>; do
  gh pr view "$n" --json number,title,url,body,baseRefName,headRefName,files
done
```

Repo par défaut : celui du cwd. Hors repo, `--repo accor-hotels/product-data-apps`.

Si `body` est vide ou creux, lire le diff (`gh pr diff <n> --name-only`, et le diff
complet si les chemins ne suffisent pas) : le message décrit ce que la PR fait, pas
ce que sa description raconte.

## 2. Ordre et stack

Une PR est **empilée** sur une autre quand son `baseRefName` est le `headRefName`
d'une autre PR du lot (ou quand sa description dit « empilée sur #X »). Dans ce cas :

- ordonner de la base vers le sommet ;
- numéroter `PR 1/2`, `PR 2/2`, etc.

PR indépendantes : **pas** de ligne `PR x/y` du tout. Ne jamais numéroter des PR qui
n'ont pas de lien de base entre elles, même postées ensemble.

## 3. Format

```
<url brute>
PR 1/2
<ligne de contenu>
<ligne de contenu>

<url brute>
PR 2/2
<ligne de contenu>
```

Règles dures :

- **URL brute seule sur sa première ligne.** Teams auto-linkifie ; le markdown
  `[texte](url)` n'est pas rendu dans la zone de composition et casserait le lien.
- Aucun markdown : pas de `#`, pas de `-`/`*`, pas de gras, pas de tableau, pas de
  backticks. Uniquement des lignes de texte nu.
- Ligne vide entre deux PR, jamais à l'intérieur d'une PR.
- Ne pas répéter l'URL en fin de bloc, ne pas ajouter d'en-tête ni de formule
  d'appel (« Salut à tous », « merci d'avance ») : l'utilisateur les ajoute lui-même
  s'il en veut.

## 4. Lignes de contenu

Une à quatre lignes par PR. Style télégraphique, français, sans ponctuation finale :

- fragments nominaux, pas de phrases conjuguées : « Partie API / BDD pour le crud
  Categories », « Correctifs visuel tailwind », « Suppression page temporaire
  Upload S3 » ;
- une idée par ligne, dans l'ordre d'importance pour un reviewer ;
- `->` pour une conséquence ou une précision qui change la lecture :
  « Finalement 4 segments et non pas 2 -> chaque segment a ses propres produits » ;
- vocabulaire fonctionnel (ce que ça change pour le produit), pas le détail
  d'implémentation : pas de noms de fichiers, pas de chemins, pas de noms de
  composants — sauf si c'est *le* sujet de la PR (ex. « Refactor hook
  activeWorkspace ») ;
- mentionner le couple front/API quand la PR est d'un seul côté d'une paire
  (« API side », « Front side ») ;
- signaler ce qui touche un package partagé (`packages/ui`) ou supprime quelque
  chose : ça oriente le reviewer.

Ce qu'on ne met pas : le nombre de tests, la baseline verte, les cases de checklist,
la justification des choix. La description de PR porte tout ça, le message Teams
sert seulement à faire cliquer.

## 5. Sortie

Rendre le bloc dans une fence de code (pour que la copie soit propre), puis une
seule ligne de note **hors** du bloc si et seulement si elle est actionnable —
typiquement l'ordre de review d'un stack. Rien d'autre.
