#!/usr/bin/env python3
"""Context7 library detection hook - optimized for speed.

Detects library mentions in user prompts and prepends Context7 suggestions.
Runs on UserPromptSubmit hook trigger.
"""
import re
import sys

# Inline library mappings (no file I/O on every call)
LIBRARIES = {
    # Frontend Frameworks
    "react": "react",
    "next": "next",
    "nextjs": "next",
    "astro": "astro",
    "vue": "vue",
    "svelte": "svelte",
    "solid": "solid-js",
    "qwik": "qwik",
    # Styling
    "tailwind": "tailwindcss",
    "tailwindcss": "tailwindcss",
    "aceternity": "/ui.aceternity.com/llmstxt",
    "shadcn": "shadcn-ui",
    # TypeScript & Build
    "typescript": "typescript",
    "vite": "vite",
    "esbuild": "esbuild",
    "turbopack": "turbopack",
    "bun": "bun",
    # State & Data
    "tanstack": "@tanstack/react-query",
    "react-query": "@tanstack/react-query",
    "zustand": "zustand",
    "jotai": "jotai",
    "redux": "redux",
    "mobx": "mobx",
    # Backend
    "express": "express",
    "nestjs": "@nestjs/core",
    "fastify": "fastify",
    "trpc": "@trpc/server",
    "hono": "hono",
    "elysia": "elysia",
    # Database & ORM
    "prisma": "prisma",
    "drizzle": "drizzle-orm",
    "mongoose": "mongoose",
    "typeorm": "typeorm",
    "kysely": "kysely",
    # Testing
    "vitest": "vitest",
    "jest": "jest",
    "playwright": "@playwright/test",
    "cypress": "cypress",
    "testing-library": "@testing-library/react",
    # Utilities
    "zod": "zod",
    "axios": "axios",
    "lodash": "lodash",
    "dayjs": "dayjs",
    "date-fns": "date-fns",
    "uuid": "uuid",
    # APIs & Services
    "anthropic": "@anthropic-ai/sdk",
    "openai": "openai",
    "resend": "resend",
    "stripe": "stripe",
    "supabase": "@supabase/supabase-js",
    "firebase": "firebase",
    # DevOps
    "docker": "docker",
    "kubernetes": "kubernetes",
    "terraform": "terraform",
}

# Pre-compile regex pattern (runs once at module load)
PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in LIBRARIES) + r")\b",
    re.IGNORECASE,
)


def main() -> None:
    """Read prompt from stdin, detect libraries, output enhanced prompt."""
    prompt = sys.stdin.read()
    matches = set(LIBRARIES[m.lower()] for m in PATTERN.findall(prompt))

    if matches:
        libs = ", ".join(sorted(matches))
        print(f"[Context7: {libs}]\n{prompt}")
    else:
        print(prompt)


if __name__ == "__main__":
    main()
