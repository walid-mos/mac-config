---
name: setup-pre-commit
description: Set up Husky pre-commit hooks with lint-staged and Prettier. Automates installation, configuration, and verification. Use when user wants to add pre-commit hooks, code formatting, or lint-staged to a project.
user-invocable: true
---

# Setup Pre-Commit Hooks

Sets up **Husky** pre-commit hooks with **lint-staged** running **Prettier** on all staged files, plus optional typecheck and test scripts.

## What Gets Installed

- Husky (pre-commit hook runner)
- lint-staged (run linters on staged files only)
- Prettier (code formatter, if not already present)

## Workflow

### 1. Detect Package Manager

Check for lock files:

- `pnpm-lock.yaml` → pnpm
- `package-lock.json` → npm
- `yarn.lock` → yarn
- `bun.lockb` → bun

Default to npm if unclear.

### 2. Install Dependencies

```bash
<pm> add -D husky lint-staged prettier
```

### 3. Initialize Husky

```bash
npx husky init
```

This creates `.husky/` directory and adds `prepare: "husky"` to package.json.

### 4. Create `.husky/pre-commit`

```
npx lint-staged
<pm> run typecheck
<pm> run test
```

**Adapt**:

- Replace `<pm>` with detected package manager
- If repo has no `typecheck` script in package.json, omit that line and tell the user
- If repo has no `test` script in package.json, omit that line and tell the user

No shebang needed for Husky v9+.

### 5. Create `.lintstagedrc`

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

### 6. Create `.prettierrc` (if missing)

Only create if no Prettier config exists (`.prettierrc`, `.prettierrc.json`, `prettier.config.js`, etc.). Use sensible defaults:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": true,
  "trailingComma": "es5",
  "semi": false,
  "arrowParens": "always"
}
```

### 7. Verify

- [ ] `.husky/pre-commit` exists and is executable
- [ ] `.lintstagedrc` exists
- [ ] `prepare` script in package.json is `"husky"`
- [ ] Prettier config exists
- [ ] Run `npx lint-staged` to verify it works

### 8. Commit

Stage all changed/created files and commit with: `chore: add pre-commit hooks (husky + lint-staged + prettier)`

This runs through the new hooks — a good smoke test that everything works.

## Notes

- Husky v9+ does not need shebangs in hook files
- `prettier --ignore-unknown` skips files Prettier cannot parse (images, binaries, etc.)
- Pre-commit runs lint-staged first (fast, staged-only), then full typecheck and tests
