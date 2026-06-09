# Formats : tweet skill

Two output formats : **single tweet** and **thread**. Pick based on the source content's natural shape, unless the user forces with `--thread` / `--single`. All examples below are in ENGLISH.

## When single, when thread

- **Single (default)** : one observation, one ship, one hot take, one pattern. Fits in 250-280 chars with breathing room.
- **Thread** : a journey-of-work, a tutorial, a multi-step debug, an architecture explainer. 3-7 posts max. Anything longer is a blog post.
- **Long-form single** (Premium-only) : when the content needs a visual block of bullets (a penalty list, a pricing breakdown, an anti-pattern list). Picaro_11's algo penalty list is a valid template for this shape.

## Single tweet structure

Three blocks max (hook, body, kicker), in this order :

```
[hook line, sentence-case capitalization, period optional, standalone block]

[body : 1-3 sentences flowing as ONE paragraph with commas, conjunctions, comma splices. NOT line-broken by default.]

[optional kicker : question, punchline, parenthetical, or contrast, standalone block]
```

### Block cap

**3 standalone blocks per single tweet, hard ceiling (hook, body, kicker).** A block = a chunk separated by a blank line. If a draft has 4+ blocks, you're chopping the body into one-line paragraphs and losing the rhythm. Merge body sentences into one flowing paragraph.

Bad (6 blocks, choppy) :
```
Built X.

It does Y.

Last week it broke.

I fixed it.

Now it works.

Wild.
```

Good (3 blocks, flowing body) :
```
Built X to do Y.

Last week it broke, I fixed it, now it works.

Wild.
```

Length budget : 200-280 chars. Below 200 it feels thin. Above 280 it gets cut (unless Premium long-form).

### Hook patterns (single)

1. **Concrete fact** : `Oxlint on 40k LOC : 1.2s. ESLint : 38s.`
2. **Counter-intuitive ship** : `Just deleted 2k lines today, the app got faster.`
3. **Money/time saved** : `Hetzner at 4€/month is replacing my 47€/month AWS setup.`
4. **Tool swap callout** : `Bun is already installed everywhere. No reason to keep npm in CI.`
5. **Dumb question** : `Why is Vercel charging $20/month for a static site`
6. **Mini-confession** : `Shipped 3 projects this year. 2 are dead. The 3rd pays the rent.`
7. **Before/after** : `Build before turbo prune --docker : 4m 12s. After : 38s.`
8. **Hot take** : `If your monorepo doesn't ship one docker image per app, it's a folder.`

## Thread structure

```
Post 1 (hook) : the strongest line. End optionally with 🧵 or 👇. No "thread" prefix.

---

Post 2 : context or "here's what i tried first"

---

Post 3-N : one insight per post, each readable standalone

---

Last post : a clean closer (NOT a CTA)
```

### Thread rules

- **Post separator is `---` on its own line, surrounded by blank lines. ALWAYS.** This is the ONLY thing that splits a thread into posts. Blank lines INSIDE a post are for hook/body/kicker blocks (per single tweet structure), not post boundaries. No `---` = single tweet. The UI parses this strictly; any other convention will render as one giant post.
- Each post is a complete thought. A reader who lands on post 4 still gets value.
- No `1/7` `2/7` numbering. X auto-threads, the reader sees the counter natively.
- The 🧵 emoji is optional and goes at the END of post 1, not the start. Skip it if the hook is strong.
- Last post NEVER says "follow for more". Acceptable closers :
  - A direct question to the reader
  - A blunt one-line summary of the lesson
  - A link to the repo / blog / demo if it actually exists
  - A punchline that lands

### Hook patterns (thread)

1. **Promise with proof** : `Shipped X this week. What worked, what broke, the 3 things I won't do again 👇`
2. **Counter-intuitive lead** : `Thought the answer was Y. Turned out to be Z. Quick write-up 👇`
3. **Saved hours** : `Here's the setup I use for [task]. Most devs spend 3h on this. Mine takes 20 min 👇`
4. **Failure story** : `Broke prod at 11pm last night. What happened and what I changed after 👇`
5. **Architecture lift** : `How I deploy 10 client sites on one 4€/month VPS 👇`
6. **Live audit** : `Audited my own monorepo this morning. Found 8 issues in 30 min, fixed 6 already 👇`

## Long-form single (Premium-only)

Use when the content is a list of 5+ items with concrete payload (penalty signals, pricing breakdown, anti-patterns). A single dense post often beats a thread for this shape because it stays readable in one view and earns bookmarks.

Template :

```
🚨 [hook line, what this list is about]

[1-line setup if needed]

❌ [item 1]
❌ [item 2]
❌ [item 3]
...

[optional closing line]
```

Or the positive variant :

```
✅ [hook]

✅ [item 1]
✅ [item 2]
...
```

Use sparingly. Default is still single short or thread.

## Anti-patterns (always cut)

- Threads about threads (`how i hit 10k followers in 6 months`)
- Numbered lists of "tips" with no concrete example or number
- Pure summarizing of someone else's article without adding your own work or opinion
- Cliffhangers without payoff (`the third one will surprise you`, `wait for the end`)
- Reading the X algorithm rules out loud (Picaro_11 can, the user shouldn't copy that move)
- Empty hooks (`i just realized something important`, `here's a thing nobody talks about`)
- "Open in app" bait, "click bookmark before reading" tricks

## NextNode CTA (use ONLY when natural)

If the content naturally lands on a NextNode service, a single-line close is acceptable :

- `(this is also what we do at NextNode if you want to chat)`
- `link in bio if you want to work together`

Default is ZERO CTA. Tweets earn the right to a CTA by being valuable on their own. Most won't, and that's fine.

## Char budget enforcement

- Single tweet : 280 chars hard ceiling. Aim 250.
- Thread post : 280 chars each. Aim 220 to leave space for line breaks and avoid weird wrapping.
- Long-form single (Premium) : up to 25000 chars but readability collapses past ~1500. Cap at 1500 unless the user insists.

The drafter MUST verify each candidate fits the budget. If a post is over budget, split it or trim. Never ship a 290-char "single tweet".
