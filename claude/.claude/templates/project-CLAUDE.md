# [Project Name]

> **Note**: This is a project-specific CLAUDE.md file. Global coding standards, workflows, and tool configurations are defined in `~/.claude/CLAUDE.md` and should NOT be duplicated here.

## 📋 Project Overview

**Purpose**: [Brief description of what this project does]

**Status**: [Development / Staging / Production]

**Repository**: [GitHub/GitLab URL]

---

## 🏗️ Architecture

### Project Structure

```
project-root/
├── src/
│   ├── components/     # React components
│   ├── lib/            # Utility functions
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   └── app/            # Next.js app directory (or pages/)
├── public/             # Static assets
├── tests/              # Test files
└── docs/               # Project documentation
```

### Key Design Patterns

- [Pattern 1]: [Description and usage]
- [Pattern 2]: [Description and usage]

### Technology Stack

**Frontend**:
- [Framework]: [e.g., React 18.x]
- [Styling]: [e.g., Tailwind CSS with cn() utility]
- [State Management]: [e.g., Zustand / Redux / Context]

**Backend** (if applicable):
- [Runtime]: [e.g., Node.js / Bun]
- [Framework]: [e.g., Express / Fastify / tRPC]
- [Database]: [e.g., PostgreSQL / MongoDB]

**Testing**:
- [Test Framework]: [e.g., Vitest]
- [Testing Library]: [e.g., React Testing Library]

**Build Tools**:
- [Bundler]: [e.g., Vite / Next.js / Webpack]
- [Package Manager]: PNPM (enforced)

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required versions
node >= 18.x
pnpm >= 8.x
```

### Installation

```bash
# Clone repository
git clone [repository-url]
cd [project-name]

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start development server
pnpm dev

# Run in watch mode (if applicable)
pnpm dev:watch
```

---

## 🛠️ Key Commands

### Development
```bash
pnpm dev                # Start development server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run linter
pnpm lint:fix           # Auto-fix linting issues
pnpm type-check         # Run TypeScript type checker
```

### Testing
```bash
pnpm test               # Run all tests
pnpm test:watch         # Run tests in watch mode
pnpm test:coverage      # Run tests with coverage report
pnpm test:ui            # Open Vitest UI
```

### Database (if applicable)
```bash
pnpm db:migrate         # Run database migrations
pnpm db:seed            # Seed database with test data
pnpm db:studio          # Open database GUI (Prisma Studio, etc.)
```

### Other
```bash
pnpm clean              # Clean build artifacts
pnpm format             # Format code with Prettier
```

---

## 📁 Important Files & Locations

### Configuration Files
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`tsconfig.json`** - TypeScript configuration
- **`vitest.config.ts`** - Vitest test configuration
- **`.env.example`** - Environment variable template

### Key Source Files
- **`src/lib/utils.ts`** - Contains `cn()` utility and other helpers
- **`src/components/ui/`** - shadcn/ui components (if using)
- **`src/types/`** - Global TypeScript type definitions
- **`src/lib/api.ts`** - API client configuration

### Documentation
- **`README.md`** - Project README (installation, usage)
- **`docs/`** - Additional documentation
- **`CONTRIBUTING.md`** - Contribution guidelines (if applicable)

---

## 🎯 Project-Specific Conventions

### Naming Conventions

**Components**:
```tsx
// PascalCase for component files and exports
// Filename: UserProfile.tsx
export function UserProfile() { }
```

**Utilities**:
```tsx
// camelCase for utility files and functions
// Filename: formatDate.ts
export function formatDate(date: Date) { }
```

### Component Organization

```tsx
// Standard component structure
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  // Props definition
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // 1. Hooks
  const [state, setState] = useState()

  // 2. Derived state / Memoized values
  const computed = useMemo(() => { }, [])

  // 3. Event handlers
  const handleClick = () => { }

  // 4. Effects
  useEffect(() => { }, [])

  // 5. Render
  return <div />
}
```

### API Route Patterns (if applicable)

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Handler logic
  return NextResponse.json({ data })
}
```

---

## 🔌 External Integrations

### APIs Used
- **[API Name]**: [Purpose] - [Documentation URL]
- **[API Name]**: [Purpose] - [Documentation URL]

### Third-Party Services
- **[Service Name]**: [Purpose] - [Configuration location]
- **[Service Name]**: [Purpose] - [Configuration location]

### Environment Variables Required

```bash
# Application
NEXT_PUBLIC_APP_URL=          # Application URL
NODE_ENV=                      # development | production

# Database (if applicable)
DATABASE_URL=                  # PostgreSQL connection string

# Authentication (if applicable)
NEXTAUTH_SECRET=               # NextAuth.js secret
NEXTAUTH_URL=                  # NextAuth.js URL

# External APIs
[API_NAME]_API_KEY=           # API key for [Service]
```

---

## 🧪 Testing Strategy

### Test Organization

```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── e2e/               # End-to-end tests (if applicable)
```

### Testing Patterns

**Component Tests**:
```tsx
import { render, screen } from '@testing-library/react'
import { UserProfile } from './UserProfile'

describe('UserProfile', () => {
  it('should render user name', () => {
    render(<UserProfile name="John Doe" />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })
})
```

**API Tests** (if applicable):
```tsx
describe('GET /api/users', () => {
  it('should return user list', async () => {
    const response = await fetch('/api/users')
    const data = await response.json()
    expect(data).toHaveLength(3)
  })
})
```

---

## 🚨 Common Issues & Solutions

### Issue 1: [Common Problem]
**Problem**: [Description]

**Solution**:
```bash
# Steps to resolve
```

### Issue 2: [Another Problem]
**Problem**: [Description]

**Solution**:
```bash
# Steps to resolve
```

---

## 🔄 Deployment

### Build Process

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Run linting and type checking
pnpm lint
pnpm type-check

# 3. Run tests
pnpm test

# 4. Build for production
pnpm build
```

### Deployment Platforms
- **[Platform Name]**: [e.g., Vercel / Netlify / AWS]
- **Configuration**: [Location of config files]

### Environment-Specific Notes
- **Development**: [Special considerations]
- **Staging**: [Special considerations]
- **Production**: [Special considerations]

---

## 📚 Additional Resources

### Documentation
- [Internal Docs]: [URL or location]
- [API Docs]: [URL]
- [Design System]: [URL or location]

### Related Projects
- [Project Name]: [Description and relation]

### Useful Links
- [Figma Designs]: [URL]
- [Project Board]: [URL]
- [Monitoring Dashboard]: [URL]

---

## 👥 Team & Contacts

**Project Lead**: [Name]
**Tech Lead**: [Name]
**Repository Maintainers**: [Names]

---

## 📝 Notes for Claude Code

### Project-Specific Workflows

**Before starting work**:
1. Always ensure on latest `develop` branch
2. Create feature branch from `develop` (not `main`)
3. Check that `.env` is properly configured

**Special Commands**:
- `pnpm [custom-command]`: [Description of what it does]

### Project-Specific Rules

- **Database Migrations**: Always create migration files, never modify existing ones
- **API Routes**: Follow RESTful conventions for endpoint naming
- **Component Library**: Use shadcn/ui components from `src/components/ui/` when possible
- **State Management**: Use [Zustand/Redux/Context] for global state, local state for component-specific

### Known Gotchas

- [Gotcha 1]: [Description and how to avoid]
- [Gotcha 2]: [Description and how to avoid]

---

**Last Updated**: [Date]
**Template Version**: 1.0
