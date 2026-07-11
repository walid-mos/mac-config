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

### 3. Choose the destination folder

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

### 4. Check for an existing note

Grep the vault for a note on the same topic before writing. If one exists,
update/append it (bump `modified` in frontmatter) instead of creating a
duplicate.

### 5. Write the note

Filename = the note's title, natural casing, `.md`. Meeting notes:
`Meetings/YYYY-MM-DD <personne ou sujet>.md`.

Frontmatter (get the timestamp via `date +%Y-%m-%dT%H:%M:%S`):

```markdown
---
created: <ISO local, no timezone>
source: claude-code
tags: [<voir _Conventions.md>]
---

# <Titre>
```

Tags come from the conventions list: `client/<slug>`, `project/<slug>`,
`meeting`, `prospection`, `strategy`, `idea`, `reference`, `finance`,
`health`, `journal`, `list`, `people`, `to-file`…

Body rules:

- **Linking is mandatory** (see "Links (graph)" in `_Conventions.md`):
  every note gets ≥ 2 wikilinks — its hub (`[[Igocreate]]`,
  `[[Hermes (AI)|Hermes]]`…) plus the people/projects/tools it mentions
  (`[[Arnaud]]`, `[[Hline]]`). If related notes don't fit the prose, add a
  `## Liens` footer (2–5 links). Grep the vault for candidate note titles
  to link against — a link to a non-existent note is fine (future hub),
  but prefer resolving to real notes.
- Entities → links, types/status → tags. Never `#igocreate`.
- Keep the note self-contained: no references to "cette session" or the
  repo you happen to be in, unless the note is about it.
- French or English following the content's language; don't translate.

### 6. Confirm

Report the full path written (and whether it was a create or an update) so
the user can jump to it in Obsidian.
