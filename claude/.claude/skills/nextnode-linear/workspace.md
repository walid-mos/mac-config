# Workspace map

Live state of the NextNode Solutions Linear workspace. **This file gets stale** - refresh it with the recipe at the bottom whenever projects, teams, or initiatives change.

## Organization

- Name: `Nextnode Solutions`
- urlKey: `nextnode`
- ID: `188254b1-8b5b-4435-adbb-e0dd3f2fe0d5`

## Teams

| Key | Name     | ID                                       | Purpose                            |
|-----|----------|------------------------------------------|------------------------------------|
| SAS | SaaS     | `3e027494-8ee6-4e7c-b406-62d842b901d1`   | Products                           |
| INT | Internal | `113334ef-299c-4929-85ae-c78cc49972ce`   | Platform, tooling, infrastructure  |
| CLI | Clients  | `ed9542bb-4839-425f-8ec2-d031696a1ac5`   | Client work                        |

## Projects (12 active)

### SaaS team (SAS) - products

| Project          | Repo                                  | Project ID                              |
|------------------|---------------------------------------|------------------------------------------|
| NextNode Landing | `NextNodeSolutions/nextnode-landing`  | `24b8dbe1-787e-4a8c-a99c-25e1cbb43656`   |
| YSumAI           | `NextNodeSolutions/ysumai`            | `ecead2c2-ca8b-41e7-8e0c-933162cd4698`   |
| Kicked           | `NextNodeSolutions/kicked`            | `46dba6bc-867a-4ee5-bfca-b4dca19e001a`   |
| Adiffi           | `NextNodeSolutions/adiffi`            | `d8d92f90-2af1-4b90-b36b-da4e08c3c405`   |
| Agent Cockpit    | (internal, no public repo)            | `f84f7e83-f8bc-4f74-9927-b961f0c99750`   |
| Scribe           | `tweet-ui` (local tool)               | `94c47c22-b7f7-49c1-974b-e47f478e7d00`   |

### Internal team (INT) - `core` monorepo packages

All 6 are packages within `NextNodeSolutions/core` at path `packages/<name>`. Grouped under the `NextNode Core` Initiative.

| Project                 | Path in `core` repo        | Project ID                              |
|-------------------------|----------------------------|------------------------------------------|
| NextNode Infrastructure | `packages/infrastructure`  | `01860302-1e60-4876-ac21-c2c512be5616`   |
| NextNode Monitoring     | `packages/monitoring`      | `4f071df2-42ee-45e0-8228-a887d2e2a898`   |
| NextNode Standards      | `packages/standards`       | `f27b2264-a536-494e-bd0c-2603b966dadd`   |
| NextNode Logger         | `packages/logger`          | `dee42582-2380-4337-9b03-7a8313670b24`   |
| NextNode Brand Assets   | `packages/brand-assets`    | `57923f31-165c-447b-8a05-873b83ce1bc1`   |
| NextNode Email Manager  | `packages/email-manager`   | `26013c75-a9e8-41e9-9108-ad4cd2bfd0b1`   |

### Clients team (CLI) - client deliverables

| Project              | Repo                                    | Project ID                              |
|----------------------|-----------------------------------------|------------------------------------------|
| Gardefroidclim       | `NextNodeSolutions/gardefroidclim`      | `3f399b6a-d074-425a-b2be-f77cfaf57230`   |
| Fleurs d'Aujourd'hui | `NextNodeSolutions/fleursdaujourdhui`   | `13ab04f8-cd61-451a-a04d-aad1c79009c1`   |

## Initiatives

| Name           | ID                                       | Groups                              |
|----------------|------------------------------------------|-------------------------------------|
| NextNode Core  | `0b6ab0ad-c5fb-45b7-90cf-da0c520ee4dc`   | The 6 INT projects (core monorepo)  |

## Workflow states (same for all teams)

`Backlog → Todo → In Progress → In Review → Done`

Plus terminal cancel states: `Canceled`, `Duplicate`.

## Repos NOT in Linear

These exist in the `NextNodeSolutions` GitHub org but are not tracked in Linear:

| Repo                  | Status                          | Reason                                |
|-----------------------|----------------------------------|---------------------------------------|
| `infrastructure`      | Archived                         | Replaced by `core/packages/infrastructure` |
| `archives_kicked`     | Archived (legacy)                | Predecessor of `kicked`               |
| `yasmine`             | Toy / tutorial repo              | Not a deliverable                     |
| `test-e2e`            | Test target for `core/infrastructure` | Should be tracked as issues inside NextNode Infrastructure project, not its own project |

## Refresh recipe

When projects, teams, or initiatives change, refresh this file:

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query":"{ organization { id name urlKey } teams { nodes { id key name } } projects(first: 100) { nodes { id name teams { nodes { key } } } } initiatives { nodes { id name } } }"}' | jq
```

Then update the tables above and commit the change.
