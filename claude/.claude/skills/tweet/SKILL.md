---
name: tweet
description: >-
  Draft or polish a tweet/thread in the user's voice. Use when the user runs
  `/tweet`, says "fais-moi un tweet", "tweet ça", "genere un thread",
  "balance ça sur X", "corrige <tweet>" / "fix <tweet>", or shares a
  screenshot of something shipped and wants it published.
user-invocable: true
argument-hint: "corrige <text> | [--thread|--single] [topic or free description]"
---

# tweet

This file is the entry point and the workflow. The doctrine lives in three companion files. Edit them, not the agent.

## Companion files

Do NOT load for: rewriting a post the user already drafted (they iterate manually), LinkedIn content (different beast, different audience).

1. `./voice.md` : persona, FR/EN code-switch, banned and approved expressions
2. `./formats.md` : single tweet structure, thread structure, hook library, char budgets
3. `./algo.md` : X algorithm signals (dwell time, slop score, bookmark value)

## Modes

Two modes, detected from `$ARGUMENTS`:

- **Polish mode** : `$ARGUMENTS` starts with `corrige`, `fix`, or `polish` (case-insensitive). Used when the user has already written a tweet (often a reply, sometimes a standalone) and wants the English cleaned up without losing their voice. Handled INLINE by the skill, no subagent spawn.
- **Draft mode** (default) : anything else. Spawns the `tweet-drafter` subagent to produce 2 finalists from scratch.

## Arguments

`$ARGUMENTS` (optional):

- `corrige <text>` / `fix <text>` / `polish <text>` : polish mode, the rest of the string is the tweet to correct
- Free text (no prefix) : draft mode, the topic or the "voila ce que jai fait"
- `--thread` : draft mode only, force a thread
- `--single` : draft mode only, force a single tweet
- Topic and flag can be combined in draft mode

If `$ARGUMENTS` is empty, follow the input-resolution order in the draft-mode workflow below. **Never silently pull from older conversation turns.** The user typed `/tweet` deliberately; if they didn't say what to tweet, ask.

## Polish-mode workflow

Used when `$ARGUMENTS` starts with `corrige`, `fix`, or `polish`. Single-shot, no subagent.

### Step 1 : parse the input

Strip the `corrige` / `fix` / `polish` prefix from `$ARGUMENTS`. The rest is the text to polish.

If the text is empty after stripping, ask : `colle le tweet a corriger`. Stop and wait.

### Step 2 : load doctrine

Read `./voice.md`, `./formats.md`, `./algo.md`. The polish must respect them.

### Step 3 : polish inline

Apply these transformations IN ORDER. Each one is conservative : fix only what's actually wrong.

1. **Translate to English** : if the input is not already English, render it in natural dev-twitter English. Keep the voice (see `voice.md`), the structure, and any FR/EN code-switch tokens that are part of the persona. Do NOT formalize.
2. **Typos and spelling** : obvious misspellings, wrong word ("their" / "they're", "your" / "you're")
3. **Grammar** : subject-verb agreement, prepositions, articles, tense consistency
4. **Awkward phrasing** : idiom misuse, word order, French false-friends (`actually` for `currently`, `eventually` for `possibly`, `important` for `large`, etc.)
5. **Capitalization** : capital first letter of the tweet, `I` capitalized, proper nouns capitalized
6. **Em-dash removal** : if the user wrote `—`, replace with hyphen, comma, parentheses, or a line break. Always.
7. **Banned expressions** : if a slop opener, hype emoji as content, or LLM-formal trope from `voice.md` is present, remove or rewrite it
8. **Char budget** : if the post is over 280 chars, trim. Never silently truncate; if a cut changes meaning, flag it

**Polish-mode HARD BANS**

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Reorganize structure or reorder blocks | Keep original structure exactly |
| Add content, examples, or context | Only fix what is actually wrong |
| Change the angle, message, or punchline | Preserve intent and voice tics |
| Formalize tone beyond fixing real errors | Match voice.md persona |
| Add emojis, hashtags, or CTAs not present | Remove those explicitly banned in voice.md |
| "Improve" intentional style tics (line breaks, `tbh`, comma splices) | Treat voice tics as correct |

### Step 4 : return

Output format, verbatim, no preamble :

```
Original:
<user's text exactly as pasted>

Polished:
<corrected version>

Changes:
- <fix 1, one line>
- <fix 2>
- ...
```

If the input has a genuine phrasing choice with two valid paths (rare), return both as `Polished 1` / `Polished 2` with separate change lists.

If the input is already clean, return `Polished: (no changes needed)` and skip the Changes block. Do not invent fixes to look busy.

## Draft-mode workflow

### Phase 1 : resolve the input

Walk this resolution order and STOP at the first hit. Do not combine sources.

1. **`$ARGUMENTS` non-empty** → use it as the topic/description.
2. **Screenshots attached to the current turn** → use them. If text is also present, combine with text.
3. **Current session has a clear shipping signal** (the assistant just finished a refactor, a deploy, a feature, an audit in the immediate prior turns of THIS session): propose it explicitly to the user, e.g. `je crois que tu veux tweeter le swap eslint → oxlint qu'on vient de faire. tu confirmes ?`. Wait for confirmation. Never assume.
4. **Nothing usable** → ask one open question : `qu'est-ce que tu veux tweeter ?`. Stop.

Once the topic is resolved, also collect:

- **Format hint** : `--thread`, `--single`, or `auto`
- **Repo context** (only if explicitly relevant to the topic) : `git log --oneline -5`. Never spam diffs.

### Phase 2 : spawn the drafter

Spawn the `tweet-drafter` agent via the Agent tool with the resolved topic, format hint, and any repo context. Show the 2 finalists verbatim, copy-paste ready, rationale collapsed below. No preamble.

If the user wants another pass, rerun `/tweet` with their feedback in `$ARGUMENTS`. Do not loop autonomously.

## Hard rules

See `./voice.md` § "Language" and § "Banned expressions". Em-dash, AI attribution, hashtags, pull-CTAs, French output : all forbidden, both modes. Single source of truth lives there.

## Storage

Tweets are ephemeral. Do not write them to disk unless the user asks. If asked, write to `./docs/notes/tweets/<YYYY-MM-DD>-<slug>.md` (one file per tweet/thread, final text + rationale).
