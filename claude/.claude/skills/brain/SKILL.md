---
name: brain
description: >-
  Save a markdown note/deliverable into the Obsidian "Brain" vault instead
  of the scratchpad, repo, or other usual Claude locations, auto-filing it
  into the right folder per the vault's conventions. Trigger on /brain,
  "enregistre dans mon brain", "sauvegarde dans obsidian", "mets ça dans
  le vault", "note ça dans mon brain".
user-invocable: true
---

# Brain — save notes into the Obsidian vault

Vault root (write directly, it syncs via iCloud):

```
/Users/walid-mos/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain
```

When this skill is invoked, the markdown output goes into the vault — NOT
into the scratchpad, NOT into a `notes/` folder of the current repo, NOT
into `~/.claude`.

**The vault is an encyclopedia, not a summary pad.** The note is the
archive of the knowledge produced — it gets read months later, without the
conversation, and must stay actionable alone. Writing a thin recap of a
rich session destroys the work instead of storing it. See
[Complétude](#complétude) below; it is the rule that most often gets
broken.

## Pipeline

### 1. Read the live conventions

`_Conventions.md` at the vault root is the source of truth for folder
structure, tags and rules. Read it FIRST every time — it evolves, and it
beats the summary below whenever they disagree.

### 2. Determine what to save

- Argument given (`/brain <sujet>` or a file path) → that content.
- No argument → the main markdown deliverable of the current session
  (topo, recherche, notes de meeting, idée, snippet). If the session
  produced nothing note-shaped, ask what to capture.

### 3. Split the deliverable into notes

A session usually produces several distinct objects of knowledge. **One
note = one thing you would look up on its own.** Monolith and confetti are
symmetrical failures; run this procedure instead of guessing.

1. **Inventory** the entities and concepts actually covered: tool, model,
   API, package, method, decision, person.
2. **Autonomy test**, for each: *six months from now, would I search for
   this on its own, from a context unrelated to this note?* Yes → its own
   note. No → stays inside the parent.
3. **Substance threshold**: ≥ ~5 lines of its own material to deserve a
   note. Below that it stays inline — a stub pollutes more than it serves.
4. **Two destinations, by reusability.** A fact about an outside entity
   (tool, model, API, package) you would look up from an unrelated context
   → `5. Reference/Dev/<Entity>.md`, which becomes its **owner**. Reasoning,
   decisions and trade-offs specific to the subject → the subject's folder.
5. **Source it, don't copy it.** The subject note never duplicates the
   fact: it cites the owner inline, where it leans on it. Links are
   bidirectional — each child links the spine, the spine links each child.
6. **Never split to shorten.** A coherent line of reasoning stays one
   note however long it is. Cut on concept boundaries, never on size.

**Subject folder and spine note.** As soon as a subject outgrows one note
it becomes a `<Sujet>/` folder:

- **`<Sujet>.md` — the spine, homonymous with the folder.** The name is
  mandatory: `[[Sujet]]` resolves to *that file* (never to the folder), so
  renaming it to `index.md` or `_<Sujet>.md` breaks every inbound link. It
  is also Obsidian's de-facto folder-note convention.
- **Tag `hub` in its frontmatter** — the marker that tells it apart from
  its children in the quick-switcher; `tag:#hub` lists every spine.
- One note per concept, named by the **concept alone** — never prefixed
  with the subject, the path already carries it.
- In the spine, a **`## Notes du sujet`** section: one line per child with
  its description, plus links to the outside reference notes.

Same pattern as the "cours" in `_Canvas.md`. A subject folder is the one
allowed **exception to max-depth-2**, and it does not nest further.

Announce the split in the confirmation (step 7) so the user can challenge
the boundaries.

### 4. Choose the destination folder

Apply `_Conventions.md`. Condensed decision table (verify against the live
file):

| Content | Destination |
|---|---|
| Client work (billed / for someone else): meeting, spec, décision | `2. NextNode/Clients/<Client>/` (meetings under `Meetings/`) |
| Prospection, stratégie, admin NextNode | `2. NextNode/Prospection|Strategy|Admin/` |
| Personal project (Hermes (AI), NextNode internal, Adiffi, Kicked…) | `3. My Projects/<Projet>/` |
| Raw idea, one note each | `4. Ideas/` |
| Dev snippet, commande, prompt, doc technique | `5. Reference/Dev/` |
| Config machine / setup | `5. Reference/Setup/` |
| Learning notes | `5. Reference/Learning/` |
| People, finance, health, journal, lists | `6. Personal/<Sous-dossier>/` |
| Genuinely unsure | `0. Inbox/` + tag `to-file` |

Hard rules:

- **Max depth 2** (folder + subfolder). Never create a third level.
- **Never create a new top-level folder.** New subfolder only if the
  conventions already imply it (e.g. a new client under `Clients/`).
- **Two Hermes**: `Hermès (client)` → `2. NextNode/Clients/Igocreate/`;
  `Hermes (AI)` → `3. My Projects/Hermes (AI)/`.
- When the choice is ambiguous between two plausible folders, prefer
  `0. Inbox/` + `to-file` over guessing — filing is cheap, un-filing isn't.

### 5. Check for an existing note

Grep the vault for a note on the same topic before writing. If one exists,
update/append it (bump `modified` in frontmatter) instead of creating a
duplicate.

### 6. Write the note

Filename = the note's title, natural casing, `.md`. NEVER prefix with the
folder's name (`Odin/Cheatsheet syntaxe.md`, not
`Odin/Odin — Cheatsheet syntaxe.md`) — the path already carries that
context. Meeting notes: `Meetings/YYYY-MM-DD <personne ou sujet>.md`.

NO `# H1` repeating the title in the body — Obsidian shows the filename as
inline title, an H1 duplicates it on screen. The body starts directly at
the content; headings inside the note start at `##`.

Frontmatter (get the timestamp via `date +%Y-%m-%dT%H:%M:%S`):

```markdown
---
created: <ISO local, no timezone>
source: claude-code
tags: [<voir _Conventions.md>]
---

<contenu directement — pas de # H1>
```

Tags come from the conventions list: `client/<slug>`, `project/<slug>`,
`meeting`, `prospection`, `strategy`, `idea`, `reference`, `finance`,
`health`, `journal`, `list`, `people`, `to-file`… plus `hub` on a spine
note, which adds to the type tag rather than replacing it
(`tags: [idea, hub]`).

Body rules:

- **Linking is mandatory** (see "Links (graph)" in `_Conventions.md`):
  every note gets ≥ 2 wikilinks — its hub (`[[Igocreate]]`,
  `[[Hermes (AI)|Hermes]]`…) plus the people/projects/tools it mentions
  (`[[Arnaud]]`, `[[Hline]]`). Grep the vault for candidate note titles to
  link against — a link to a non-existent note is fine (future hub), but
  prefer resolving to real notes.
- **Link inline, encyclopedia-style.** First mention of an entity that has
  its own note → wikilink right there in the sentence, not parked in a
  footer. A factual note a piece of reasoning leans on is a **source**:
  link it at the exact point it is used. The `## Liens` footer is only for
  related notes that found no natural place in the prose — a note whose
  links are all inline needs no footer.
- **Relevance beats the quota.** A link needs a real relationship (same
  hub, same tool, a note this one extends) — never vocabulary proximity.
  If only two notes are genuinely related, link two and stop. Padding the
  `## Liens` footer to hit a number poisons the graph. When in doubt about
  a link, drop it and say so in the confirmation.
- Entities → links, types/status → tags. Never `#igocreate`.
- Keep the note self-contained: no references to "cette session" or the
  repo you happen to be in, unless the note is about it.
- French or English following the content's language; don't translate.

### Complétude

**The most frequently broken rule — read it before writing.** The note
must carry the full substance of what the session produced, not a digest
of it.

- **Everything substantive goes in**: code blocks, exact identifiers,
  versions, prices, beta header names, API parameters, comparison tables,
  numbers, thresholds, error messages. A technical detail quoted verbatim
  in the conversation appears verbatim in the note.
- **Never compress a finding into a bullet that loses the detail.**
  "Watch out for unsupported params" is worthless; "`output_config` and
  `fallbacks` return 400 on that endpoint, hence the `anthropicOnly` flag"
  is knowledge.
- **Alternatives evaluated and rejected belong in the note**, with the
  reason — that is what prevents redoing the study in three months.
- **Open questions and next steps** go in too; without them the note is
  unresumable.
- **When in doubt, keep it.** An over-long note costs nothing; an amputated
  one costs redoing the work.
- **TERSE.md governs chat output, never note content.** Terse mode must not
  bleed into the vault.
- **Test before writing**: could someone reading *only* this note act on
  it? If not, it is incomplete — expand it before saving.
- This is about **substance, not template**. An explicit format request
  ("liste de tâches" → checkboxes) still wins on form; completeness
  applies to the matter inside that form.
- Updating an existing note that is thinner than what the session produced
  → **enrich it**, don't leave it as is.

### 7. Confirm

Report the full path written (and whether it was a create or an update) so
the user can jump to it in Obsidian. Also state anything from the session
you deliberately left out and why, and flag any link you were unsure about
— that is what lets the user catch an amputated note immediately.

## Canvas deliverables (`.canvas`) and cours

When the deliverable is a visual concept map ("canvas", "schéma",
"carte mentale") or a "cours", read `_Canvas.md` at the vault root
BEFORE writing — like `_Conventions.md`, it is the live source of
truth (layout rules, cours pattern, embed syntax) shared with Hermes.
Folder and filename rules above still apply.
