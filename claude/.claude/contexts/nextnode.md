# NextNode Internal Tools

Internal tools and libraries for NextNode Solutions at `~/Development/Nextnode/`.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| config-manager | `~/Development/Nextnode/config-manager/` | Configuration management |
| design-system | `~/Development/Nextnode/design-system/` | UI component library |
| email-manager | `~/Development/Nextnode/email-manager/` | Email service abstraction |
| github-actions | `~/Development/Nextnode/github-actions/` | Centralized GH workflows |
| http-client | `~/Development/Nextnode/http-client/` | HTTP client with retry |
| infrastructure | `~/Development/Nextnode/infrastructure/` | Terraform/deployment |
| logger | `~/Development/Nextnode/logger/` | @nextnode/logger |
| playground | `~/Development/Nextnode/playground/` | Experimentation |
| project-generator | `~/Development/Nextnode/project-generator/` | Scaffolding CLI |
| project-templates | `~/Development/Nextnode/project-templates/` | Templates |
| standards | `~/Development/Nextnode/standards/` | Lint/format configs |
| syneva-cli | `~/Development/Nextnode/syneva-cli/` | Deployment CLI |
| validation | `~/Development/Nextnode/validation/` | Validation library |

## Conventions

- @nextnode/eslint-plugin rules
- pnpm + changesets for versioning
- tsup for bundling (ESM-only)
- Vitest for testing

## Publishing

```bash
pnpm changeset
pnpm changeset:version
pnpm changeset:publish
```
