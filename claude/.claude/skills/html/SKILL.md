---
name: html
description: >-
  Generate a single self-contained HTML deliverable (plan, audit, review,
  retro, research, decision record, triage board) styled with the shared
  NextNode shell. Load on "génère un html", "fais-moi un récap html", or any
  session whose output is a standalone HTML artifact (not a product UI).
user-invocable: true
---

# HTML

Form follows data. The same skill produces an implementation plan, a review writeup, a retro, a research explainer, or a triage board — each with its own shape. Pick the shape from the intent; never pour every output into the same 6-section markdown-in-HTML template.

**You write only the body content.** All chrome (tokens, dark mode, anti-FOUC, theme toggle, sidebar + scrollspy, copy buttons, diff rendering, CDN lazy-loaders) is pre-built in `assets/` and assembled by the build script. Re-typing any of it is a bug, not thoroughness.

## Pipeline

1. **Pick the shape** from the intent (table below). Compose freely from the block vocabulary.
2. **Read `./reference.md`** for the markup vocabulary (block classes, data-islands, rich-mode forms).
3. **Write the body fragment** to a temp file (e.g. `/tmp/<slug>.body.html`): semantic markup only — sections, blocks, inline SVG. No `<html>`, no `<head>`, no stylesheet, no runtime script.
4. **Build**:
   ```bash
   bash ~/.claude/skills/html/scripts/build.sh /tmp/<slug>.body.html \
     -t "Titre du document" -o docs/notes/<YYYY-MM-DD>-<slug>.html
   ```
   Flags: `-l` lang (default `fr`) · `-m rich` feedback-loop mode · `-w prose` 760px reading width · `-s on|off` force sidebar (auto: shows at ≥6 `section[id]`) · `-n pages|scroll` force navigation (auto: pages as soon as a section carries `data-group`) · `-b` brand label.
5. **Open it**: `open -g <path>` on macOS (background obligatoire — `open` nu vole le focus), `xdg-open` on Linux, or the Chrome MCP with a `file://` URL if connected.

## Shapes

**La table est un menu, pas une checklist.** Chaque ligne liste le *maximum disponible* d'une intention — pioche les blocs que ta donnée porte réellement, ignore le reste. Un plan de 3 paragraphes n'est pas un `header + strip + file-tree + timeline + flow + risk-grid + next-steps` ; c'est un `header + tldr + un bloc + next-steps`. Pars du contenu, jamais de la ligne.

| Intent | Composition (max disponible — pioche) |
|---|---|
| Implementation plan | header + strip + file-tree + timeline + flow diagram + risk-grid + next-steps |
| Code review writeup | header + tldr + diff + file-by-file (tabs si >3 fichiers) + pills by severity |
| Architecture audit | header + svg module map + findings + risk-grid + next-steps |
| Retro / post-mortem | header + timeline (minute-by-minute) + twocol good/bad + next-steps |
| Research / explainer | header + tldr + prose sections (`-w prose`) + diagrams + sources |
| Triage / backlog board | header + board data-island (`-m rich` if decisions come back) |
| Decision record | header + diag-compare/ctable (2 options) or tabs (3+) + callout (decision) + risk-grid |
| Status report | header + strip + timeline + twocol shipped/slipped |

## Rules

- **Poids = contenu, pas vocabulaire** (smell n°1 : livrable plus lourd que sa charge utile). Seuils checkables : **≤ ~6 blocs réels et 0 domaine distinct → UNE vue** (header + 1-2 blocs + next-steps), pas de `<section id>` multiples, pas de sidebar, pas de mode pages ; **1 domaine, ≥6 sections séquentielles → sidebar scrollspy** ; **≥2 domaines thématiques → `data-group` → pages**. Ne fabrique jamais une section ni un diagramme pour atteindre un seuil. _3 paragraphes de contenu ≠ 7 sections._
- **Un bloc = une donnée.** Test avant d'écrire : retire le bloc — s'il ne manque rien d'informatif, ne l'écris pas. **Pas de bloc spatial inventé** : `diagram`/`SVG`/`timeline`/`board` seulement si le contenu est réellement spatial/temporel ; sinon prose dense + `strip` suffisent. (Un mur de `<h2>`+`<p>` est un smell ; un diagramme décoratif pour « cocher un bloc spatial » en est un pire.)
- **Densité de prose** : mène avec le bloc structuré, la prose ne fait que relier. Une `<section>` porte ≤2 courts paragraphes avant de devenir un bloc/sous-section/`.fold` ; `.lead` = 1 phrase ; `tldr` ≤4. Donnée brute/longue énumération → `<details class="fold">`, jamais inline.
- **Content only, never invented**: if the data for a block isn't there, omit the block.
- **Per-doc custom styling is allowed** — one `<style>` at the top of the body fragment — but only `var(--np-*)` tokens, **no color literal**. New color = new token in `np.css`, not a hex in the doc.
- **Layout = multipage par domaines, pas un long scroll.** Dès qu'un doc couvre plusieurs domaines (≳3 sections qui se rangent par thème : `Auth` / `Données` / `Ops`, ou par sous-système, par sévérité…), tague chaque `<section>` avec `data-group="Domaine"`. Le runtime bascule alors en **mode pages** : chaque domaine devient une page swappable, la sidebar devient un routeur (une vue par écran, zéro long scroll), prev/next en bas de page. C'est le défaut attendu pour tout livrable substantiel — l'empilement vertical d'une douzaine de sections est précisément le smell à éliminer. Sections d'un même domaine consécutives = une page (sous-liens dans la sidebar) ; sans `data-group` un doc ≥6 sections garde un sidebar scrollspy classique. Force avec `-n pages` / `-n scroll`.
- **Navigation _dans_ une page, par nature du contenu** : séquentiel (étapes, timeline, récit) → scroll ; parallèle (variantes, scénarios, par-fichier — le lecteur compare, il ne lit pas dans l'ordre) → tabs (`data-np="tabs"`) ; détail optionnel (annexe, données brutes) → fold. Un doc dont les sections s'empilent alors qu'elles se comparent est aussi cassé qu'un mur de `<p>`.
- **Real architecture schemas → D2** (`<div data-np="d2">`, build-time inline SVG, requires `d2` via `make claude-post`). See reference.md.
- **Accent discipline**: saturated `--np-accent` = the lone primary CTA + thin indicators only. Highlight blocks use `--np-bg-soft` + 4px accent left border, never an `--np-accent-bg` fill. Orange is never a primary action.
- **Code blocks**: always `<figure class="code-block" data-file="…">` + `language-*` class. Escape `<`/`>` inside `.diff` content.
- **Every interactive/editable doc exports**: copy buttons (`data-copy`, board exports) are the loop back into the agent — never ship a dead end.
- **CDN allowlist is closed** (mermaid, highlight.js — auto-loaded by the runtime). Never add another `<script src>`.
- **Section ids**: explicit `id` on every `<section>` you anchor; unique, kebab-case. The sidebar builds itself from `section[id] > h2`.

## Output paths

- Implementation plan → `docs/plans/<YYYY-MM-DD>-<slug>.html`
- Rich-mode interview closure → `docs/interviews/<slug>/plan.html`
- Everything else → `docs/notes/<YYYY-MM-DD>-<slug>.html`

A caller skill that specifies a different path wins.

## Multi-fichiers

Un livrable reste un fichier autonome par défaut. Splitte en plusieurs `.html` inter-liés quand le doc sert **plusieurs lectures distinctes** (vue d'ensemble vs détail par sous-système, plan vs annexes de recherche, une page par étape d'un gros plan) — pas quand il est juste long : long + une seule lecture = sidebar, contenus parallèles = tabs. Si tu splittes : un fichier index (header + strip + liens vers chaque partie), liens **relatifs** entre fichiers (`./<slug>-partie.html`), même dossier, même date dans les slugs, et chaque partie reste lisible seule (son propre header + lien retour).

## Rich mode (`-m rich`)

For docs whose answers must come back as typed data (open questions, decisions, tunable values, board ordering). The runtime auto-instruments prose as contenteditable (skip-zones: pre, table, diagrams, forms, `.static`) and injects a sticky Approve/Reject gate that POSTs to `./submit` (clipboard fallback if no server). Contract on return: `approval_mode: "approved"` → start implementing immediately, no restating; `"rejected"` → don't implement, ask for direction. Serve with `rp <slug>` in background and give the user the URL (read it from stdout / `.rp-url` — never assume the port).

**Surface TOUTES les décisions ouvertes — aucun plafond.** S'il y en a 600, montre les 600. Ne replie jamais une vraie question en « défaut énoncé » pour faire baisser un compteur : le problème n'a jamais été le *nombre*, c'est l'**affichage**. Un mur de 600 radios empilés est cassé ; 600 décisions bien rangées ne le sont pas. La seule règle de tri légitime est sémantique, pas quantitative : si plusieurs micro-choix sont *des facettes d'une même décision*, ce sont des axes/options d'UN form (compare-axes, tabs), pas N forms — mais c'est de la mise en forme, pas de la coupe.

**L'affichage encaisse l'échelle, lui.** Pour beaucoup de questions, c'est la structure qui porte la charge, pas un cap : (1) `data-group` par domaine sur leurs sections → le routeur éclate en pages (~N questions/domaine, une vue par écran) ; (2) l'overview auto se **groupe par domaine et se replie** (index de domaines repliables, pas une liste plate de 600 lignes) ; (3) la progression de la gate compte le tout. Plus il y a de questions, plus `data-group` est obligatoire — c'est ça qui tue le scroll, pas la suppression de questions.

**Review-the-default, jamais fill-N-blanks.** Chaque question atterrit **pré-répondue sur ta reco** : marque l'option recommandée `<label class="opt" data-recommended>` (le runtime la coche, la badge `reco`, la remonte). Répondre = scanner, surcharger les rares désaccords. Le runtime auto-construit (≥3 questions) un **overview scannable** (chaque décision + sa réponse, point modifié/défaut, jump-link) + une progression live dans la gate. `.q` reste un **titre court (≤6 mots)** — l'enjeu va dans `.recommended` ou `.rq-stake`, jamais dans `.q` (sinon l'overview casse).

**Chaque choix décidable _en pleine connaissance_** — pas des radios nus. Selon le poids de la question :
- **Triviale (oui/non)** → liste `.opt` nue + `.recommended` une ligne.
- **Architecturale / lourde (le lecteur compare)** → composant **compare-axes** (`form.rich-question.rq-axes`) : options en colonnes, axes en lignes (Comportement / Coût / Conséquence), **un exemple inline + une conséquence color-codée par cellule**, et un **schéma** (`.rq-schema`) quand la question est spatiale. Le lecteur balaie une dimension à travers toutes les options. Markup complet dans reference.md.

Quand l'interview couvre plusieurs domaines : `data-group` sur leurs sections → le routeur éclate en pages par domaine au lieu d'un mur.

## Before declaring done

- Shape matches intent; every section anchored; no invented content.
- **Poids justifié** : retire chaque bloc/section mentalement — si rien d'informatif ne manque, supprime-le. 3 paragraphes de fond ⇒ une vue, pas 7 sections. Aucun bloc spatial fabriqué. Prose : ≤2 paragraphes/section, détail long folded.
- **Navigation** : multi-domaines → `data-group` (→ pages, zéro long scroll) ; un doc qui reste un seul scroll vertical est le smell à corriger.
- Body fragment contains no hex/oklch literal and no chrome duplication (`grep -nE '#[0-9A-Fa-f]{3,8}|oklch\(' /tmp/<slug>.body.html` → only hits inside an explicitly justified `<style>` are acceptable, ideally zero).
- Built file opens without console errors; dark mode renders (toggle it once). Pages mode: each sidebar entry swaps the view; deep-links (`#section-id`) open the right page.
- Rich mode : **toutes les décisions ouvertes sont surfacées** (aucune coupée pour un compteur) ; beaucoup de questions ⇒ `data-group` par domaine (pages + overview groupé/replié), jamais un mur empilé ; chaque `.q` ≤6 mots ; chaque question a une option `data-recommended` pré-sélectionnée ; les choix lourds utilisent `rq-axes` (exemple + conséquence par cellule, schéma si spatial), pas des radios nus ; `name` distincts ; overview + progression construits (≥3 questions).
