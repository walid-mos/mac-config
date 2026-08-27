# Epics and tickets

## Titles

A title is an **outcome sentence**, in the present tense, from the point of
view of whoever benefits. Not a task, not a layer, not a component name.

- Ticket: `Le visiteur demande à acquérir une toile, qui est réservée 72 h pour lui`
- Ticket: `Toute entrée de l'API est validée avant d'atteindre la base`
- Epic: `Atelier — catalogue : Mina gère ses œuvres elle-même`
- Never: `Ajouter le endpoint POST /acquisition`, `Refacto du client API`, `E4.2`

Epics may carry a domain prefix (`Atelier — journal : …`) when the project
has several surfaces. Never number a title — Plane owns the identifiers.

## Epics

An epic is a set of tickets that together deliver one standalone outcome.
Sizing: roughly 3 to 8 tickets. Twelve epics for a whole product is normal;
one epic per ticket means the epic is not an outcome.

A purely technical epic is allowed when nothing else is deliverable without
it — say so explicitly in `Intention` rather than inventing user value.

<epic-template>
```html
<div>
<h3>Intention</h3>
<p>Ce que cette épique installe, en deux ou trois phrases. Si elle est
purement technique, l'assumer ici.</p>
<h3>Valeur livrée</h3>
<p>Ce qui devient possible à la fin, et ce qui reste impossible sans elle.</p>
<h3>Terminée quand</h3>
<ul>
<li>Condition de sortie observable, une par ligne.</li>
</ul>
<h3>Périmètre de fichiers</h3>
<p><code>chemin/verifie/un.ts</code>, <code>chemin/verifie/deux.ts</code></p>
<h3>Hors périmètre</h3>
<p>Ce qu'un lecteur croirait couvert ici et qui ne l'est pas.</p>
</div>
```
</epic-template>

## Tickets: vertical slices

- Each ticket cuts a **narrow but complete** path through every layer it needs
  (schéma, API, UI, tests) — vertical, never a horizontal slice of one layer.
- A finished ticket is **demoable or verifiable on its own**.
- Sized for **one fresh context window**: one coherent change, on the order of
  ten files or fewer. If you cannot state what it delivers in one sentence,
  split it.
- **Prefactoring goes first**, as its own ticket. "Make the change easy, then
  make the easy change."
- Blocking edges are declared per ticket. A ticket with no blockers starts now.

### Exception: wide refactors

A mechanical change whose blast radius fans across the codebase (rename a
column, retype a shared symbol) cannot land green as a vertical slice.
Sequence it **expand–contract**:

1. **Expand** — add the new form beside the old; nothing breaks.
2. **Migrate** — one ticket per batch sized by blast radius (per package, per
   directory), each blocked by the expand. CI stays green because the old form
   still exists.
3. **Contract** — delete the old form, blocked by every migrate batch.

## Ticket templates

Two shapes. Use the technical one only when there is genuinely no user-facing
outcome, and justify it.

<story-template>
```html
<div>
<h3>Récit</h3>
<p>En tant que &lt;acteur&gt;, je veux &lt;capacité&gt;, afin de &lt;bénéfice&gt;.</p>
<h3>Valeur</h3>
<p>Pourquoi ce ticket existe, et ce qui casse s'il n'est pas fait.</p>
<h3>Critères d'acceptation</h3>
<ul>
<li>Étant donné &lt;état&gt;, quand &lt;action&gt;, alors &lt;résultat observable&gt;.</li>
<li><code>pnpm --filter @scope/app test</code> passe.</li>
</ul>
<h3>Notes techniques</h3>
<ul>
<li>État de départ : ce qui existe aujourd'hui, fichiers et symboles exacts, vérifiés le &lt;date&gt;.</li>
<li>À créer / à modifier : les emplacements attendus, avec l'art antérieur à imiter.</li>
<li>Contrat : entrées, sorties, codes, forme d'erreur.</li>
</ul>
<h3>Pièges</h3>
<ul>
<li>Le footgun précis, et ce qu'il faut faire à la place.</li>
</ul>
<h3>Bloquée par</h3>
<p><code>PROJ-12</code> — intitulé du bloqueur. Ou : aucune, peut démarrer immédiatement.</p>
</div>
```
</story-template>

<technical-ticket-template>
```html
<div>
<h3>Ticket technique — justification</h3>
<p>Aucune valeur utilisateur directe. Ce qui serait impossible ou faux sans lui.</p>
<h3>Objectif</h3>
<p>L'état du système à la fin, en une phrase.</p>
<h3>Critères d'acceptation</h3>
<ul><li>…</li></ul>
<h3>Notes techniques</h3>
<ul><li>…</li></ul>
<h3>Pièges</h3>
<ul><li>…</li></ul>
<h3>Bloquée par</h3>
<p>…</p>
</div>
```
</technical-ticket-template>

`Bloquée par` est écrit dans le body **et** mentionné comme dépendance dans
Plane si les outils le permettent (les relations natives `blocked_by` ne sont
pas disponibles via pi actuellement — rester sur le texte uniquement).

## The agent-ready gate

Run this against every ticket before publishing. A failure is not a nit: it
is the reason an agent will stop and ask a human, which is the one thing this
skill exists to prevent.

1. **No open question.** No "à trancher", "TBD", "à voir", "selon", "peut-être".
   Search the body for them literally.
2. **Starting state verified.** Every path, export, script, table, column and
   route named in the body was read this session. Add the verification date.
3. **Nothing invented.** Anything referenced either exists (verified) or is
   explicitly created by this ticket. Never assume a route, a selector, a test
   helper or a config key.
4. **Criteria are observable.** Each one is a command that exits zero, a
   response an agent can assert, or a state change it can read back. Delete
   "le code est propre".
5. **At least one executable check.** A real script or task from the repo,
   quoted exactly. If the tooling does not exist yet, creating it is part of
   this ticket and is stated as such.
6. **Vertical.** It reaches every layer it needs to be verifiable alone.
7. **One context window.** One coherent change; split if not.
8. **Self-contained.** Readable and implementable with only this body and the
   repo. It repeats the vocabulary and decisions it needs; it never says
   "voir l'épique".
9. **Blocking edges complete.** Everything that genuinely gates it is listed,
   and nothing that does not. At least one ticket has no blockers.
10. **Traps recorded.** Every footgun found while exploring this area appears
    in `Pièges`, with the correct move.
11. **Vocabulary consistent.** The project's domain words, verbatim, in the
    title and the body.

Report the gate result as a table — one row per ticket, the failed check
numbers or `ok`.

## Anti-patterns seen in this workspace

- `Le statut cible est à trancher avec la story de traitement des demandes` —
  an open decision inside a ticket. Grill it, or the agent stops here.
- `Ordre impératif : exécuter cette story en dernier` in prose, with no
  dependency edge on the tracker. Prose is invisible to a frontier query.
- `E11.5 — Smoke E2E` as a title. An identifier and a layer, not an outcome.