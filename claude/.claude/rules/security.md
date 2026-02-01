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

- Use environment variables for secrets (never hardcode)
- Provide `.env.example` templates (without real values)
- Add sensitive patterns to `.gitignore`

## Code Security

- **Input validation:** Sanitize and validate all user input
- **SQL injection:** Use parameterized queries, never string interpolation
- **XSS prevention:** Use framework escaping (React auto-escapes) or DOMPurify

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
