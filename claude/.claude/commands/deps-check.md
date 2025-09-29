# /deps-check

Comprehensive dependency analysis: outdated packages, security audit, unused imports, and optimization suggestions.

## Task

I'll perform a thorough analysis of your project dependencies: identify outdated packages, run security audits, detect unused imports, and provide optimization recommendations.

## Process

I'll execute this comprehensive analysis:

1. **Package Analysis**: Check for outdated and vulnerable packages
2. **Security Audit**: Run security vulnerability scans
3. **Unused Dependencies**: Identify packages that aren't being used
4. **Import Analysis**: Find unused imports in source code
5. **Size Analysis**: Analyze bundle impact and suggest optimizations
6. **Recommendations**: Provide actionable upgrade and cleanup suggestions

## Implementation Details

### Package Manager Detection
- **PNPM**: Primary package manager (per CLAUDE.md)
- **NPM/Yarn**: Fallback support with appropriate commands
- **Lock File Analysis**: Parse lock files for detailed dependency trees

### Outdated Packages Analysis
```bash
# Check for outdated packages
pnpm outdated

# Check for major version updates
pnpm outdated --long

# Security-focused updates
pnpm audit
```

### Security Vulnerability Scanning
- **PNPM Audit**: Built-in vulnerability database
- **Snyk Integration**: Advanced security scanning if available
- **GitHub Advisory**: Cross-reference with GitHub security advisories
- **License Compliance**: Check for license compatibility issues

### Unused Dependency Detection
```bash
# Find unused dependencies
npx depcheck

# Alternative: unimported
npx unimported

# TypeScript-specific unused imports
npx ts-unused-exports
```

## Expected Output

```
🔍 Starting comprehensive dependency analysis...

📦 Package Manager: PNPM
📁 Project Type: TypeScript/React
📊 Total Dependencies: 127 (dev: 45, prod: 82)

🔄 Step 1/6: Checking outdated packages...
┌─────────────────────┬─────────┬─────────┬─────────┐
│ Package             │ Current │ Wanted  │ Latest  │
├─────────────────────┼─────────┼─────────┼─────────┤
│ react               │ 18.2.0  │ 18.3.1  │ 18.3.1  │
│ typescript          │ 5.0.4   │ 5.1.6   │ 5.6.2   │
│ @types/node         │ 18.15.0 │ 18.19.0 │ 22.5.4  │
│ vite                │ 4.3.9   │ 4.5.0   │ 5.4.6   │
└─────────────────────┴─────────┴─────────┴─────────┘

🛡️  Step 2/6: Security audit...
┌─────────────────────┬──────────┬─────────────────────┐
│ Severity            │ Count    │ Packages            │
├─────────────────────┼──────────┼─────────────────────┤
│ High                │ 1        │ semver              │
│ Moderate            │ 3        │ json5, loader-utils │
│ Low                 │ 2        │ minimatch           │
└─────────────────────┴──────────┴─────────────────────┘

🗑️  Step 3/6: Unused dependencies...
Unused dependencies (4):
  - lodash (install: 847kb, impact: high)
  - moment (install: 329kb, impact: medium)
  - chalk (install: 78kb, impact: low)
  - uuid (install: 45kb, impact: low)

📝 Step 4/6: Unused imports analysis...
Unused imports found in 12 files:
  src/utils/helpers.ts: import { debounce } from 'lodash'
  src/components/DatePicker.tsx: import moment from 'moment'
  src/types/index.ts: import { UUID } from 'crypto'

📊 Step 5/6: Bundle size analysis...
Large dependencies affecting bundle size:
  - react-dom: 1.2MB (essential)
  - @mui/material: 2.1MB (consider tree shaking)
  - lodash: 847KB (unused - remove)
  - moment: 329KB (consider date-fns alternative)

💡 Step 6/6: Optimization recommendations...
Generated comprehensive recommendations report.
```

## Detailed Analysis Reports

### Security Vulnerabilities
```
🛡️  Security Analysis Report
═══════════════════════════════

High Severity Issues (1):
┌─────────────────────────────────────────────────────┐
│ Package: semver                                     │
│ Version: 7.3.8 → 7.5.4                            │
│ Issue: ReDoS vulnerability in semver parsing        │
│ Fix: pnpm update semver                            │
│ Impact: Potential DoS attack vector                │
└─────────────────────────────────────────────────────┘

Moderate Severity Issues (3):
• json5: Prototype pollution vulnerability
• loader-utils: Path traversal vulnerability
• minimatch: ReDoS vulnerability

🔧 Quick Fix Commands:
pnpm audit --fix
pnpm update semver json5 loader-utils minimatch
```

### Unused Dependencies Report
```
🗑️  Unused Dependencies Analysis
═══════════════════════════════════

Total potential savings: 1.3MB

High Impact Removals:
• lodash (847KB) - No imports found
  pnpm remove lodash

• @types/lodash (15KB) - Depends on lodash
  pnpm remove @types/lodash

Medium Impact Removals:
• moment (329KB) - 1 unused import found
  Consider: date-fns (smaller alternative)
  pnpm remove moment && pnpm add date-fns

Low Impact Removals:
• chalk (78KB) - Build script only
• uuid (45KB) - Crypto.randomUUID() available
```

### Bundle Optimization Suggestions
```
📊 Bundle Optimization Report
═══════════════════════════════

Current bundle size: 12.4MB
Potential savings: 2.1MB (17% reduction)

Tree Shaking Opportunities:
• @mui/material: Import specific components
  ❌ import { Button } from '@mui/material'
  ✅ import Button from '@mui/material/Button'

• lodash: Use specific imports (if keeping)
  ❌ import _ from 'lodash'
  ✅ import { debounce } from 'lodash/debounce'

Alternative Suggestions:
• moment → date-fns: 329KB → 78KB (76% smaller)
• lodash → native methods: Remove completely
• @mui/material → @mui/joy: Consider lighter alternative
```

## Interactive Cleanup

### Automated Fixes
```
🔧 Found 23 issues that can be auto-fixed.

Apply automatic fixes? [y/N]: y

✅ Updated 8 packages to fix security vulnerabilities
✅ Removed 4 unused dependencies
✅ Fixed 12 unused import statements
✅ Updated package.json scripts

Manual review required for:
- moment → date-fns migration (breaking changes)
- @mui/material tree shaking setup
- TypeScript version upgrade (v5.0 → v5.6)
```

### Upgrade Wizard
```
🚀 Dependency Upgrade Wizard

Select packages to upgrade:
  [x] react: 18.2.0 → 18.3.1 (patch, safe)
  [x] typescript: 5.0.4 → 5.1.6 (minor, safe)
  [ ] typescript: 5.1.6 → 5.6.2 (major, review required)
  [x] vite: 4.3.9 → 5.4.6 (major, breaking changes)
  [x] @types/node: 18.15.0 → 22.5.4 (major, check compatibility)

Proceed with selected upgrades? [y/N]:
```

## Continuous Monitoring Setup

### Package.json Scripts
```json
{
  "scripts": {
    "deps:check": "pnpm outdated && pnpm audit",
    "deps:unused": "npx depcheck",
    "deps:update": "pnpm update --interactive",
    "deps:clean": "pnpm prune && pnpm install"
  }
}
```

### Pre-commit Hook Integration
```bash
# Add to .husky/pre-commit
pnpm audit --audit-level moderate
npx depcheck --quiet
```

This command provides comprehensive dependency management and optimization guidance for your project.