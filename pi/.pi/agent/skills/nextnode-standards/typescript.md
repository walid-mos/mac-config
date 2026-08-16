# Config: TypeScript

**Version**: new projects ALWAYS use TypeScript 7 (`typescript@^7`, native compiler — `tsc` CLI is drop-in, `tsc --noEmit` unchanged). Never pin a new project to 5.x/6.x; those are legacy-only for repos not yet migrated.

**Exception — Astro apps**: `astro check` (via `@astrojs/language-server`) requires the programmatic TS API that the native compiler does not ship yet — it hard-fails on typescript 7. Astro apps stay on `typescript@^6` until upstream support lands: https://github.com/withastro/roadmap/discussions/1321 (check this link at scaffold time; drop the exception once shipped).

**Export paths** - pick by project type:

| Config | Use when |
|--------|----------|
| `@nextnode-solutions/standards/typescript/library` | Publishable npm package (logger, infrastructure, email-manager, any `package.json` with `exports`) |
| `@nextnode-solutions/standards/typescript/nextjs` | Next.js app (`next` in dependencies) |
| `@nextnode-solutions/standards/typescript/astro` | Astro app (`astro` in dependencies) |

## Project setup

Create `tsconfig.json` at the project root:

```jsonc
// For a library/package
{
  "extends": "@nextnode-solutions/standards/typescript/library",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}

// For a Next.js app
{
  "extends": "@nextnode-solutions/standards/typescript/nextjs",
  "include": ["src", "next-env.d.ts"],
  "exclude": ["node_modules", ".next", "vitest.config.ts"]
}

// For an Astro app
{
  "extends": "@nextnode-solutions/standards/typescript/astro",
  "exclude": ["vitest.config.ts"]
}
```

## Library config highlights

- **Target**: ES2024
- **Module**: ESNext with bundler resolution
- **Maximum strictness**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`
- **ESM-ready**: `isolatedModules`, `verbatimModuleSyntax`
- **No emit**: uses tsdown/other bundler for output

## Next.js config highlights

- Target ES2024, same strictness as library (minus `exactOptionalPropertyTypes` and `verbatimModuleSyntax`)
- `jsx: "preserve"` (Next.js handles JSX transform)
- `incremental: true` for faster rebuilds
- Includes `dom` and `dom.iterable` libs

## Astro config highlights

- Extends `astro/tsconfigs/strict`
- `module: "preserve"` (Astro handles resolution)
- Target ES2024
- Peer dependency: `astro ^6.0.0 || ^7.0.0` (astro 7 allowed via core#55)
- **New Astro apps ALWAYS target Astro 7** — scaffold with `pnpm create astro@latest`, never pin back to 6. The `^6.0.0` side of the peer range exists only for apps not yet migrated.
