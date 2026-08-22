---
name: visual-check
user-invocable: true
description: >-
    Visually verify frontend UI after code changes: auto-detect project pages,
    open them in headless Chromium via pi-frontend-check, capture screenshots
    the LLM sees, analyze layout/styling/console errors, and report issues.
    Use after local execution, after editing UI code, before committing, or as the
    per-maillon gate in /ship and /stack — whenever the rendered output needs
    a pair of AI eyes.
---

# Visual Check

Tu as un navigateur Chromium headless piloté par le LLM via les outils de
`pi-frontend-check`. L'idée : le LLM utilise ses capacités de vision pour
**regarder** le rendu et détecter les problèmes visuels, pas du pixel diff.

This is the one name. Load `visual-check`, not `frontend-testing`.

## Installation (une fois)

```bash
pi install npm:pi-frontend-check
```

## Deux modes d'utilisation

```
/visual-check                                 → mode local (build + auto-détection)
/visual-check https://staging.example.com     → mode externe (check ce site)
/visual-check / /about /pricing               → pages spécifiques en local
/visual-check https://site.com / /page1 /page2 → URL + pages spécifiques
```

Localhost is the default. This skill **may** open a user-given http(s) URL
for proto / staging comparison (`accor-ship` vs the deployed proto).

---

## Mode 1 : Local (dev serveur)

### 1. Build + lance le serveur

Si le caller a déjà un serveur (ex. `accor-ship` → `pnpm dev:compliance`)
ou a donné commande/port : **réutiliser**, ne pas en lancer un second.
Sinon : package manager du repo (`pnpm` si `pnpm-lock.yaml`, sinon `npm`)
et le script `dev` du `package.json`. Fallback framework :

| Framework    | Commande                              | Port |
| ------------ | ------------------------------------- | ---- |
| Astro        | `<pm> run build && npx astro preview` | 4321 |
| Next.js      | `<pm> run dev`                        | 3000 |
| Vite / React | `<pm> run dev`                        | 5173 |
| Autre        | `ask_user_question`                   | —    |

Lancer en arrière-plan seulement si rien n'écoute déjà. Attendre
"ready" / "listening", noter le port.

### 2. Détection automatique des pages

Toujours essayer dans cet ordre :

1. **Pages explicites** : si l'utilisateur a donné des paths, les utiliser.
2. **Sitemap** : `frontend_open http://localhost:<port>/sitemap.xml` — si XML
   valide, extraire toutes les `<loc>`.
3. **Liens de la page d'accueil** : `frontend_eval` pour récupérer tous les
   liens internes, dédupliquer, exclure anchors `#` et liens externes.
4. **Structure du projet** : détecter le framework et lister les fichiers de
   routes :
    - Astro : `src/pages/**/*.astro`
    - Next.js : `app/**/page.tsx`
    - SvelteKit : `src/routes/**/+page.svelte`
    - Autre : demander via `ask_user_question`
5. **Fallback** : demander les paths via `ask_user_question`.

Limiter à **10 pages max** par run.

---

## Mode 2 : Externe (URL directe)

Pour checker un site déjà déployé (staging, preview, production, prototype).
Allowed when the user (or a caller skill) gives the URL.

### Déroulement

1. **Base URL** donnée par l'utilisateur ou le caller (sinon `ask_user_question`).
2. Détection des pages :
    - D'abord les paths explicitement donnés (ex: `/about`)
    - Puis tenter le `sitemap.xml` sur le domaine
    - Puis `frontend_eval` pour lister les liens internes depuis la homepage
    - Fallback : `ask_user_question`
3. Même workflow de check que le mode local.

### Cas d'usage typiques

- **Preview deploy** : `/visual-check https://pr-42.preview.vercel.app`
- **Staging vs prod** : ouvrir les deux et comparer les screenshots
- **Proto vs implémentation** : ouvrir le proto et le site, le LLM compare

---

## Workflow de check (commun aux deux modes)

### 1. Ouvrir la page

```
frontend_open <url>
```

**Le LLM doit activement regarder le screenshot retourné** et juger :

- La page s'affiche-t-elle correctement ?
- Éléments superposés, tronqués, invisibles ?
- Polices, couleurs, espacements cohérents ?
- Contenu manquant (images cassées, textes absents) ?
- Rendu correspond-il au proto si fourni ?

### 2. Console

Lire le **console health** retourné par `frontend_open` :

- Erreurs JS non catchées
- Requêtes 4xx/5xx
- Erreurs de rendu ou de composant

Si des erreurs sont présentes, les détailler avec `frontend_console`.

### 3. Viewport de vérification

**Desktop est le défaut :** capturer et comparer en **1440×1000**, sauf si le
caller ou l'utilisateur demande explicitement un autre viewport. Ne jamais
ajouter une vérification mobile/tablette « par défaut ».

Pour une comparaison proto/local, utiliser exactement le même viewport pour
les deux cibles (par défaut 1440×1000).

Si une revue responsive est explicitement demandée, capturer les viewports
**séquentiellement** et analyser chaque résultat avant de passer au suivant :

```
frontend_screenshot width=1440 height=1000 # desktop
frontend_screenshot width=768 height=1024  # tablette, si demandée
frontend_screenshot width=375 height=812   # mobile, si demandée
frontend_screenshot width=1440 height=1000 # restaurer le contexte desktop si nécessaire
```

`frontend_screenshot` pilote un **viewport partagé et persistant** sur l'unique
page Chromium : ne jamais lancer en parallèle des captures ou toute action qui
change `width`/`height`. Une course rendrait les captures non fiables ; la
capture terminée après le dernier redimensionnement peut être au mauvais format.

### 4. Interactions (si besoin)

```
frontend_act click @e3        # ouvrir un menu, cliquer un bouton
frontend_act scroll down 500  # voir le bas de page
```

### 5. Rapport

Compiler un rapport structuré :

```markdown
## Visual Check Report

### Pages OK

- / — clean, rendu correct en desktop 1440×1000
- /pricing — clean

### Pages avec anomalies

- /about
    - Console: 1 image 404 (logo.svg)
    - Visuel: le footer chevauche le contenu sur mobile (375px)
    - Suggestion: vérifier le min-height du container

### Pages inaccessibles

- /dashboard — 404, la route n'existe plus
```

### 6. Cleanup

- Mode local : fermer le serveur **seulement si ce skill l'a lancé**.
  Un serveur réutilisé du caller (`pnpm dev:compliance`, etc.) reste allumé.
- Mode externe : rien à faire, le navigateur se ferme en fin de session

---

## Règles importantes

- **Ne pas deviner** : si `frontend_open` timeout, ne pas réessayer
  indéfiniment. Reporter la page comme inaccessible et passer à la suivante.
- **Regarder vraiment le screenshot** : ne pas se contenter du texte. Le
  screenshot est l'entrée principale. Décrire ce qu'on voit.
- **Console errors ≠ tout** : une page peut être clean en console et avoir un
  layout cassé. Les deux sont indépendants.
- **Ne pas modifier le code depuis ce skill seul** : `/visual-check` signale,
  il ne patch pas. Quand il est appelé comme gate de `/ship` ou `/stack`, le
  parent corrige en fix direct puis relance le check.
- **Gate ship/stack** : limiter aux pages et au parcours d'acceptation du
  maillon (pas un crawl du site). Exercer le flux avec `frontend_act` /
  `frontend_eval`. Anomalie, console error ou parcours cassé = maillon non fini.
- **Limiter le scope** : 10 pages max, 3 viewports max par page. Le défaut est
  un seul viewport desktop 1440×1000 ; les viewports supplémentaires doivent
  être demandés explicitement. Si le projet a plus de pages, demander via
  `ask_user_question`.

## Conseil : config projet (optionnel)

Créer un fichier `.visdiff.json` à la racine du projet pour des réglages
persistants :

```json
{
	"pages": ["/", "/about", "/pricing", "/dashboard"],
	"viewports": [{ "width": 1440, "height": 1000 }],
	"buildCommand": "npm run build",
	"devCommand": "npm run dev",
	"port": 3000,
	"externalUrl": "https://staging.example.com"
}
```

Le skill lit ce fichier s'il existe. L'`externalUrl` permet de basculer en mode
site externe sans le passer en argument.
