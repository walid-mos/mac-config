# Config: TypeScript

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
- Peer dependency: `astro ^6.0.0` (since standards 1.10.0)
