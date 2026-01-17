#!/usr/bin/env python3
"""Session initialization hook.

Runs ONCE at session start to detect project type and set up context.
Replaces per-prompt project detection for better performance.

Runs on SessionStart hook trigger.
"""
import json
import os
import sys
from pathlib import Path

# Mapping of dependencies to detected technologies
DEPENDENCY_MAPPINGS = {
    # Frontend Frameworks
    "react": "react",
    "react-dom": "react",
    "next": "next",
    "astro": "astro",
    "vue": "vue",
    "svelte": "svelte",
    "solid-js": "solid",
    "@angular/core": "angular",

    # Styling
    "tailwindcss": "tailwind",
    "@tailwindcss/typography": "tailwind",

    # State Management
    "@tanstack/react-query": "tanstack-query",
    "zustand": "zustand",
    "jotai": "jotai",
    "redux": "redux",
    "@reduxjs/toolkit": "redux",

    # Testing
    "vitest": "vitest",
    "jest": "jest",
    "@playwright/test": "playwright",
    "cypress": "cypress",
    "@testing-library/react": "testing-library",

    # Backend
    "express": "express",
    "@nestjs/core": "nestjs",
    "fastify": "fastify",
    "@trpc/server": "trpc",
    "hono": "hono",

    # Database/ORM
    "prisma": "prisma",
    "@prisma/client": "prisma",
    "drizzle-orm": "drizzle",
    "mongoose": "mongoose",
    "typeorm": "typeorm",

    # Utilities
    "zod": "zod",
    "typescript": "typescript",
}

# Dev dependencies that indicate project type
DEV_DEPENDENCY_MAPPINGS = {
    "@types/react": "react",
    "@types/node": "node",
    "typescript": "typescript",
    "eslint": "eslint",
    "prettier": "prettier",
}


def find_project_root() -> Path | None:
    """Find the project root by looking for common project files."""
    cwd = Path.cwd()

    for parent in [cwd] + list(cwd.parents):
        markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", ".git"]
        if any((parent / marker).exists() for marker in markers):
            return parent
        if parent == Path.home():
            break

    return cwd


def detect_node_project(root: Path) -> set[str]:
    """Detect technologies from package.json."""
    detected = set()
    package_json = root / "package.json"

    if not package_json.exists():
        return detected

    try:
        with open(package_json) as f:
            data = json.load(f)

        deps = data.get("dependencies", {})
        for dep, tech in DEPENDENCY_MAPPINGS.items():
            if dep in deps:
                detected.add(tech)

        dev_deps = data.get("devDependencies", {})
        for dep, tech in {**DEPENDENCY_MAPPINGS, **DEV_DEPENDENCY_MAPPINGS}.items():
            if dep in dev_deps:
                detected.add(tech)

    except (json.JSONDecodeError, OSError):
        pass

    return detected


def detect_python_project(root: Path) -> set[str]:
    """Detect Python project and common frameworks."""
    detected = set()

    pyproject = root / "pyproject.toml"
    requirements = root / "requirements.txt"

    if pyproject.exists() or requirements.exists():
        detected.add("python")

    if pyproject.exists():
        try:
            content = pyproject.read_text()
            if "fastapi" in content.lower():
                detected.add("fastapi")
            if "django" in content.lower():
                detected.add("django")
            if "flask" in content.lower():
                detected.add("flask")
            if "pytest" in content.lower():
                detected.add("pytest")
        except OSError:
            pass

    return detected


def detect_rust_project(root: Path) -> set[str]:
    """Detect Rust project."""
    detected = set()

    if (root / "Cargo.toml").exists():
        detected.add("rust")

    return detected


def detect_go_project(root: Path) -> set[str]:
    """Detect Go project."""
    detected = set()

    if (root / "go.mod").exists():
        detected.add("go")

    return detected


def detect_config_files(root: Path) -> set[str]:
    """Detect technologies from config files."""
    detected = set()

    config_mappings = {
        "tailwind.config.js": "tailwind",
        "tailwind.config.ts": "tailwind",
        "tailwind.config.mjs": "tailwind",
        "postcss.config.js": "postcss",
        "postcss.config.mjs": "postcss",
        "vite.config.ts": "vite",
        "vite.config.js": "vite",
        "next.config.js": "next",
        "next.config.mjs": "next",
        "next.config.ts": "next",
        "vitest.config.ts": "vitest",
        "vitest.config.js": "vitest",
        "playwright.config.ts": "playwright",
        "cypress.config.ts": "cypress",
        "tsconfig.json": "typescript",
        ".eslintrc.js": "eslint",
        ".eslintrc.json": "eslint",
        "eslint.config.js": "eslint",
        "eslint.config.mjs": "eslint",
        ".prettierrc": "prettier",
        "prettier.config.js": "prettier",
        "drizzle.config.ts": "drizzle",
    }

    for config_file, tech in config_mappings.items():
        if (root / config_file).exists():
            detected.add(tech)

    return detected


def main() -> None:
    """Detect project type at session start."""
    # SessionStart hook receives JSON input
    json.load(sys.stdin)

    root = find_project_root()
    if not root:
        output = {"continue": True, "suppressOutput": True}
        print(json.dumps(output))
        return

    # Collect all detected technologies
    detected = set()
    detected.update(detect_node_project(root))
    detected.update(detect_python_project(root))
    detected.update(detect_rust_project(root))
    detected.update(detect_go_project(root))
    detected.update(detect_config_files(root))

    if detected:
        tech_list = ", ".join(sorted(detected))
        output = {
            "continue": True,
            "suppressOutput": True,
            "systemMessage": f"[Session initialized - Project stack: {tech_list}]",
        }
    else:
        output = {
            "continue": True,
            "suppressOutput": True,
            "systemMessage": "[Session initialized - No specific project detected]",
        }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
