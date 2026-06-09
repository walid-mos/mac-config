# Impeccable Seed Templates

Use these when running `/impeccable init` (Phase 2). Fill `PRODUCT.md` and
`DESIGN.md` from the content below instead of impeccable's generic defaults.

## PRODUCT.md

- **Register**: brand | product (chosen in Phase 1).
- **Users**: French PME/ETI clients and their end-users. Pitch at PME/ETI
  maturity — not enterprise, not toy.
- **Brand Personality**: trustworthy, clear, competent — an externalized-CTO
  voice. Confident, never hype-y.
- **Anti-references** (NextNode, layered on impeccable's): no generic-AI-SaaS
  look (purple gradients, glassmorphism, neon-on-black); no "agency theatre" —
  clarity and trust over flash; no enterprise-grade density for a PME audience.

## DESIGN.md (tokens)

Mirror NextNode tokens — never invent a palette:

- Primary **teal** (CTAs, links, primary UI); accent **orange** (highlights
  only — never a primary action); dark-mode ground navy `#141A30`.
- Fonts: Plus Jakarta Sans (display/hero only), DM Sans (everything else),
  JetBrains Mono (code).
- Source of truth is the Tailwind theme — export tokens, don't hardcode hex.
  Import `@nextnode-solutions/standards/tailwind`.
