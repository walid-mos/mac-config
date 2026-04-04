# Config: commitlint (Commit Messages)

**Export path**: `@nextnode-solutions/standards/commitlint`

## Project setup

Create `commitlint.config.js` at the project root:

```javascript
import config from '@nextnode-solutions/standards/commitlint'

export default config
```

## Rules

**Format**: `type(scope): subject`

**Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Constraints**:
- Type: lowercase, required
- Scope: lowercase, optional
- Subject: no sentence-case, no start-case, no pascal-case, no upper-case, no period at end, required
- Header: max 100 chars
- Body: max 100 chars per line, blank line before body and footer

**Examples**:
```
feat(auth): add JWT refresh token rotation
fix: prevent race condition in state update
docs(api): update endpoint documentation
refactor(logger): extract transport interface
```
