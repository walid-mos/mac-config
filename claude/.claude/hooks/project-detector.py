#!/usr/bin/env python3
"""Project type detection hook for smart guideline loading.

Analyzes project files to detect frameworks/libraries in use.
Outputs project context to help Claude load relevant guidelines.

Runs on UserPromptSubmit hook trigger.
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

    # Walk up from cwd looking for project markers
    for parent in [cwd] + list(cwd.parents):
        markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", ".git"]
        if any((parent / marker).exists() for marker in markers):
            return parent
        # Stop at home directory
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

        # Check dependencies
        deps = data.get("dependencies", {})
        for dep, tech in DEPENDENCY_MAPPINGS.items():
            if dep in deps:
                detected.add(tech)

        # Check devDependencies
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

    # Check for common Python frameworks
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
    """Detect project type and output context."""
    prompt = sys.stdin.read()

    root = find_project_root()
    if not root:
        print(prompt)
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
        print(f"[Project: {tech_list}]\n{prompt}")
    else:
        print(prompt)


if __name__ == "__main__":
    main()
