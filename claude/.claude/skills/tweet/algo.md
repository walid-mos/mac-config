# Algo : X algorithm signals

Distilled from the X algorithm publication on `github.com/twitter/the-algorithm` (March 2023) and observed by @Picaro_11. The drafter MUST keep these signals in mind when scoring candidates.

## What the algo PUNISHES (avoid)

- **"Not interested" clicks** : strong negative weight. Translation : no clickbait that pisses people off once they actually read the post.
- **Block / Mute** of your account : kills reach durably. Translation : no inflammatory takes designed for engagement bait.
- **Report** of your post : durable score drop, hard to recover. Translation : no spam, no scams, no NSFW, no impersonation.
- **Scroll without dwell time** : the algo measures reading time. Translation : the hook must promise enough that people stop and read.
- **High "slop" score detected by Grok** : AI-generated cookie-cutter content. Translation : no `Voici 5 tips pour...`, no `🚀 J'ai découvert...`, no LLM-formal French.

A single report can reduce your global score durably (per Picaro_11's read of the code).

## What the algo REWARDS

- **Long dwell time** : a reader staying 5+ seconds. Thread hooks that promise concrete payload get this.
- **Replies and quote tweets with actual reasoning** : a real conversation, not one-word reactions.
- **Bookmark** : strong positive signal, more weighted than likes. Translation : be referenceable. Listicles with concrete numbers, code snippets, before/after deltas.
- **Profile clicks from a post** : means the post was interesting enough that the reader wanted more.
- **Replies from followed accounts** : peer-validation, very strong signal.

## Drafter checklist (apply to EVERY candidate)

Before returning a candidate, score it on these five axes (1-5 each, total /20). Kill anything under 14/20 or with any single score under 3.

1. **Slop check** : does it sound like a generic AI tweet? Specific numbers, named tools, real opinions only.
2. **Dwell test** : does the hook make a dev stop scrolling and read line 2? If not, weak hook.
3. **Bookmark test** : would a dev save this for later reference? If yes, +1. If pure vibe, lower priority.
4. **Outrage check** : is the take inflammatory in a way that earns blocks more than thoughtful replies? Strong opinions OK, contempt or punching down NOT OK.
5. **Truth check** : does every specific in the post match what the user actually did? Hallucinated specifics are the fastest way to lose credibility on dev twitter.

## Reading the input for risk

If the user's input contains :

- **A specific number** : keep it verbatim. Do not round, do not embellish, do not extrapolate.
- **A tool/library name** : keep the casing exactly as the user wrote it (`Astro` not `astro`, `Hetzner` not `hetzner` in body text, though lowercase in the hook is fine per voice).
- **A client or person's name** : strip it unless the user explicitly said "you can name them".
- **A failure** : frame it honestly. No fake humility, no `lessons learned 🙏`, no `mea culpa thread`.
- **A version number** : keep it. Devs verify versions.

## What to NEVER claim

- Numbers the user did not provide (don't invent "10x faster", "50% saved")
- Outcomes the user did not confirm ("now my prod is rock solid" if the user just said "j'ai pushé")
- Recommendations as universal truths (`tout le monde devrait...`)
- Comparisons with tools the user didn't actually try

## Length and the algo

- Posts under 80 chars often read as low-effort and get scrolled past.
- Posts at 200-280 chars hit the dwell sweet spot for single tweets.
- Threads with 4-6 posts get more bookmark velocity than threads with 8+ (reader fatigue).
- Long-form single posts (Premium) earn bookmarks when they're a clean reference list (Picaro_11 template).

## Anti-cheat

Do not use any of these tactics, even if "they work" :

- Reply-bait questions designed to farm replies (`tu fais comment toi ?` at the end of every post)
- Fake polls with obvious answers
- Quote-tweeting big accounts to siphon attention without adding value
- Engagement bait via mild controversy on settled topics

The user is building a long-term audience for NextNode. Short-term engagement hacks erode the brand. Refuse them.
