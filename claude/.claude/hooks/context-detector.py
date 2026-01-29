#!/usr/bin/env python3
"""Context detection hook based on current working directory.

Detects which development context applies based on cwd and injects
relevant project context information.

Runs on SessionStart hook trigger.
"""
import json
import os
import sys

# Context definitions based on path prefixes
CONTEXTS = {
    "~/Development/SaaS/": {
        "name": "SaaS",
        "message": """[CONTEXT: SaaS Product]
Project conventions:
- Use @nextnode/* packages
- Deployment: Hetzner VPS (ALWAYS use github-actions shared workflows)
- NEVER create custom CI/CD - use existing shared workflows
- DNS: Cloudflare
- Follow NextNode brand guidelines
- Use @nextnode/logger (no console.*)

Products in this category:
- kicked, next-boilerplate, nextnode-front
- syneva, yasmine, youtube2text""",
    },
    "~/Development/Nextnode/": {
        "name": "NextNode",
        "message": """[CONTEXT: NextNode Internal Package]
Project conventions:
- @nextnode/eslint-plugin rules
- pnpm + changesets for versioning
- tsup for bundling (ESM-only)
- Vitest for testing

Publishing: pnpm changeset -> pnpm changeset:version -> pnpm changeset:publish

Infrastructure: run /infrastructure for server details""",
    },
    "~/Development/clients/": {
        "name": "Clients",
        "message": """[CONTEXT: Client Project]
Client work conventions:
- Each client has its own folder
- May have multiple related projects
- Respect client coding standards when they differ from defaults

Active clients: igocreate (hline-app, hline-backend, myhpad-mock)""",
    },
    "~/Development/Apps/": {
        "name": "Apps",
        "message": """[CONTEXT: Full Application/Monorepo]
Monorepo conventions:
- apps/ for applications
- packages/ for shared packages
- pnpm workspaces or Turborepo

Active apps: NextnodeGames (gaming platform monorepo)""",
    },
    "~/Development/Personnal/": {
        "name": "Personal",
        "message": """[CONTEXT: Personal Project]
Relaxed standards (experiments allowed)
- Security rules still apply
- No strict typing requirements for experiments""",
    },
}


def expand_path(path: str) -> str:
    """Expand ~ to home directory."""
    return os.path.expanduser(path)


def get_context_for_cwd(cwd: str) -> dict | None:
    """Find the matching context for the current working directory."""
    for prefix, context in CONTEXTS.items():
        expanded_prefix = expand_path(prefix)
        if cwd.startswith(expanded_prefix):
            return context
    return None


def main() -> None:
    """Read session data, detect context, output JSON response."""
    input_data = json.load(sys.stdin)
    cwd = input_data.get("cwd", os.getcwd())

    context = get_context_for_cwd(cwd)

    if context:
        output = {
            "continue": True,
            "suppressOutput": True,
            "systemMessage": context["message"],
        }
    else:
        output = {"continue": True, "suppressOutput": True}

    print(json.dumps(output))


if __name__ == "__main__":
    main()
