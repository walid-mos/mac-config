import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import { detectTechStack } from '../src/tech-stack.js'
import type { TechStack } from '../src/tech-stack.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_DIR = '/tmp/test-project'

function mockReadFileSync(files: Record<string, string>): void {
  vi.spyOn(fs, 'readFileSync').mockImplementation((p: fs.PathOrFileDescriptor) => {
    const filePath = String(p)
    const content = files[filePath]
    if (content !== undefined) return content
    throw Object.assign(new Error(`ENOENT: ${filePath}`), { code: 'ENOENT' })
  })
}

function mockExistsSync(paths: string[]): void {
  vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
    return paths.includes(String(p))
  })
}

function mockReaddirSync(dirs: Record<string, string[]>): void {
  vi.spyOn(fs, 'readdirSync').mockImplementation((p: fs.PathLike) => {
    const dirPath = String(p)
    const entries = dirs[dirPath]
    if (entries) return entries as unknown as fs.Dirent[]
    throw Object.assign(new Error(`ENOENT: ${dirPath}`), { code: 'ENOENT' })
  })
}

function mockStatSync(sizes: Record<string, number>): void {
  vi.spyOn(fs, 'statSync').mockImplementation((p: fs.PathOrFileDescriptor) => {
    const filePath = String(p)
    const size = sizes[filePath]
    if (size !== undefined) {
      return { size, isDirectory: () => false, isFile: () => true } as unknown as fs.Stats
    }
    return { size: 100, isDirectory: () => false, isFile: () => true } as unknown as fs.Stats
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Package manager detection from lock files
// ---------------------------------------------------------------------------

describe('detectTechStack — package manager detection', () => {
  it('detects pnpm from pnpm-lock.yaml', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.packageManager).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', async () => {
    mockExistsSync([`${PROJECT_DIR}/yarn.lock`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.packageManager).toBe('yarn')
  })

  it('detects bun from bun.lock', async () => {
    mockExistsSync([`${PROJECT_DIR}/bun.lock`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.packageManager).toBe('bun')
  })

  it('detects npm from package-lock.json', async () => {
    mockExistsSync([`${PROJECT_DIR}/package-lock.json`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.packageManager).toBe('npm')
  })
})

// ---------------------------------------------------------------------------
// Test runner detection from config files
// ---------------------------------------------------------------------------

describe('detectTechStack — test runner detection', () => {
  it('detects vitest from vitest.config.ts', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/vitest.config.ts`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { vitest: '^3.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testRunner).toBe('vitest')
  })

  it('detects jest from jest.config.js', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/jest.config.js`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { jest: '^29.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testRunner).toBe('jest')
  })

  it('detects playwright from playwright.config.ts', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/playwright.config.ts`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { '@playwright/test': '^1.40.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testRunner).toBe('playwright')
  })
})

// ---------------------------------------------------------------------------
// Framework detection from package.json
// ---------------------------------------------------------------------------

describe('detectTechStack — framework detection', () => {
  it('detects React from dependencies', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: {},
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['App.tsx'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.frameworks).toContain('react')
  })

  it('detects Next.js from dependencies', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: { next: '^14.0.0' },
        devDependencies: {},
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['page.tsx'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.frameworks).toContain('next')
  })

  it('detects Astro from dependencies', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: { astro: '^4.0.0' },
        devDependencies: {},
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.astro'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.frameworks).toContain('astro')
  })

  it('detects Express from dependencies', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: { express: '^4.18.0' },
        devDependencies: {},
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['server.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.frameworks).toContain('express')
  })
})

// ---------------------------------------------------------------------------
// Language detection from src/ file extensions
// ---------------------------------------------------------------------------

describe('detectTechStack — language detection', () => {
  it('detects TypeScript from .ts files in src/', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts', 'utils.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.languages).toContain('typescript')
  })

  it('detects JavaScript from .js files in src/', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.js', 'utils.js'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.languages).toContain('javascript')
  })
})

// ---------------------------------------------------------------------------
// Build tool detection
// ---------------------------------------------------------------------------

describe('detectTechStack — build tool detection', () => {
  it('detects vite from vite.config.ts', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/vite.config.ts`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { vite: '^5.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['main.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.buildTool).toBe('vite')
  })

  it('detects webpack from webpack.config.js', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/webpack.config.js`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { webpack: '^5.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['main.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.buildTool).toBe('webpack')
  })
})

// ---------------------------------------------------------------------------
// Config file detection
// ---------------------------------------------------------------------------

describe('detectTechStack — config file detection', () => {
  it('returns detected config file paths as project-relative', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/tsconfig.json`,
      `${PROJECT_DIR}/vitest.config.ts`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { vitest: '^3.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.configFiles).toEqual(expect.arrayContaining([
      expect.stringMatching(/tsconfig\.json/),
      expect.stringMatching(/vitest\.config\.ts/),
    ]))
    // Config file paths should be project-relative (no leading /)
    for (const configFile of result.configFiles) {
      expect(configFile).not.toMatch(/^\//)
    }
  })
})

// ---------------------------------------------------------------------------
// testCommand resolution
// ---------------------------------------------------------------------------

describe('detectTechStack — testCommand resolution', () => {
  it('resolves testCommand to a non-empty string always', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testCommand).toBeTruthy()
    expect(typeof result.testCommand).toBe('string')
    expect(result.testCommand.length).toBeGreaterThan(0)
  })

  it('falls back to "<packageManager> test" when no test runner detected', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: {},
        scripts: { test: 'echo test' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testCommand).toContain('test')
  })

  it('uses specific test runner command when detected', async () => {
    mockExistsSync([
      `${PROJECT_DIR}/pnpm-lock.yaml`,
      `${PROJECT_DIR}/package.json`,
      `${PROJECT_DIR}/vitest.config.ts`,
    ])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: {},
        devDependencies: { vitest: '^3.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.testCommand).toContain('vitest')
  })
})

// ---------------------------------------------------------------------------
// Security: file size limits (PT-SC-5)
// ---------------------------------------------------------------------------

describe('detectTechStack — file size limits (PT-SC-5)', () => {
  it('rejects config files over 1MB', async () => {
    const oversizedBytes = 1_048_577 // 1MB + 1 byte
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockStatSync({
      [`${PROJECT_DIR}/package.json`]: oversizedBytes,
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })

    await expect(detectTechStack(PROJECT_DIR)).rejects.toThrow()
  })

  it('rejects package.json over 1MB', async () => {
    const oversizedBytes = 1_048_577
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockStatSync({
      [`${PROJECT_DIR}/package.json`]: oversizedBytes,
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })

    await expect(detectTechStack(PROJECT_DIR)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('detectTechStack — edge cases', () => {
  it('handles missing package.json gracefully', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`])
    mockReadFileSync({})
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result).toBeDefined()
    expect(result.testCommand).toBeTruthy()
  })

  it('handles empty src/ directory', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({ dependencies: {}, devDependencies: {} }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: [] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result.languages).toEqual([])
  })

  it('extracts only dependencies, devDependencies, scripts from package.json', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        name: 'my-project',
        version: '1.0.0',
        description: 'A project',
        dependencies: { react: '^18.0.0' },
        devDependencies: { vitest: '^3.0.0' },
        scripts: { test: 'vitest run' },
        private: true,
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['App.tsx'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    // Should have detected react from dependencies
    expect(result.frameworks).toContain('react')
  })

  it('returns TechStack interface shape', async () => {
    mockExistsSync([`${PROJECT_DIR}/pnpm-lock.yaml`, `${PROJECT_DIR}/package.json`])
    mockReadFileSync({
      [`${PROJECT_DIR}/package.json`]: JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { vitest: '^3.0.0' },
      }),
    })
    mockReaddirSync({ [`${PROJECT_DIR}/src`]: ['index.ts'] })
    mockStatSync({})

    const result = await detectTechStack(PROJECT_DIR)

    expect(result).toHaveProperty('languages')
    expect(result).toHaveProperty('frameworks')
    expect(result).toHaveProperty('testRunner')
    expect(result).toHaveProperty('packageManager')
    expect(result).toHaveProperty('buildTool')
    expect(result).toHaveProperty('configFiles')
    expect(result).toHaveProperty('testCommand')
    expect(Array.isArray(result.languages)).toBe(true)
    expect(Array.isArray(result.frameworks)).toBe(true)
    expect(Array.isArray(result.configFiles)).toBe(true)
  })
})
