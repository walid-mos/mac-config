# Security Rules

## Critical Rules

### 1. Never Commit Secrets

**NEVER commit or expose:**
- API keys
- Access tokens
- Passwords
- Private keys
- Database credentials
- OAuth secrets
- Environment files (.env, .envrc)

### 2. Validate Before Commit

Before every commit, check for:
```bash
# Check staged files
git diff --cached --name-only

# Look for sensitive files
git diff --cached | grep -E "API_KEY|SECRET|PASSWORD|TOKEN"
```

### 3. Protected Files

Files that should NEVER be committed:
- `.env`
- `.env.*` (local, development, production)
- `.envrc`
- `secrets/` directory
- `credentials.json`
- `.aws/` directory
- `.ssh/` directory
- Any file with "secret", "key", "password" in name

## Best Practices

### Use Environment Variables

**Bad:**
```typescript
const apiKey = "sk-1234567890abcdef";
```

**Good:**
```typescript
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set");
}
```

### Git Configuration

Add to `.gitignore`:
```
.env
.env.*
!.env.example
.envrc
secrets/
credentials.json
*.key
*.pem
```

### Environment File Templates

Provide `.env.example` with placeholder values:
```bash
# .env.example
API_KEY=your_api_key_here
DATABASE_URL=postgresql://localhost:5432/mydb
```

## Code Security

### Input Validation

Always validate and sanitize user input:
```typescript
// Validate before use
function processUserInput(input: string): string {
  // Sanitize
  const sanitized = input.trim().replace(/[<>]/g, '');

  // Validate
  if (sanitized.length === 0 || sanitized.length > 1000) {
    throw new Error("Invalid input length");
  }

  return sanitized;
}
```

### SQL Injection Prevention

**Bad:**
```typescript
const query = `SELECT * FROM users WHERE id = ${userId}`;
```

**Good:**
```typescript
const query = "SELECT * FROM users WHERE id = ?";
db.query(query, [userId]);
```

### XSS Prevention

Escape user content before rendering:
```typescript
// Use framework escaping (React auto-escapes)
<div>{userContent}</div>

// Or manual escaping
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirty);
```

## OWASP Top 10 Awareness

Follow OWASP top 10 security risks:
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Authentication Failures
8. Software/Data Integrity Failures
9. Security Logging Failures
10. Server-Side Request Forgery

## Pre-commit Security Scan

If available, run security tools:
```bash
# Example tools
pnpm audit
npm audit fix
snyk test
gitleaks detect
```

## Incident Response

If secrets are accidentally committed:

1. **Revoke immediately** - Invalidate the exposed secret
2. **Rotate credentials** - Generate new secrets
3. **Remove from history** - Use git filter-branch or BFG Repo-Cleaner
4. **Notify team** - Alert relevant stakeholders
5. **Document incident** - Record what happened and how to prevent

## Enforcement

These rules are **CRITICAL** and have **NO EXCEPTIONS**.
