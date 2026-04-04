# Config: TypeScript

**Export paths**:
- `@nextnode-solutions/standards/typescript/library` — for npm packages
- `@nextnode-solutions/standards/typescript/nextjs` — for Next.js apps
- `@nextnode-solutions/standards/typescript/astro` — for Astro apps

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
  "exclude": ["node_modules", ".next"]
}

// For an Astro app
{
  "extends": "@nextnode-solutions/standards/typescript/astro",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Library config highlights

- **Target**: ES2023
- **Module**: ESNext with bundler resolution
- **Maximum strictness**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`
- **ESM-ready**: `isolatedModules`, `verbatimModuleSyntax`
- **No emit**: uses tsup/other bundler for output

## Next.js config highlights

- Same strictness as library (minus `exactOptionalPropertyTypes` and `verbatimModuleSyntax`)
- `jsx: "preserve"` (Next.js handles JSX transform)
- `incremental: true` for faster rebuilds
- Includes `dom` and `dom.iterable` libs

## Astro config highlights

- Extends `astro/tsconfigs/strict`
- `module: "preserve"` (Astro handles resolution)
- Target ES2022
