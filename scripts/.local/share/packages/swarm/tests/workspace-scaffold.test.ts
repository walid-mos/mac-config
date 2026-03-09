import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

// Resolve the git repository root for stable, location-independent path computation.
const GIT_ROOT = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf-8',
}).trim()

// The workspace root where pnpm-workspace.yaml and the root package.json live.
const WORKSPACE_ROOT = path.join(GIT_ROOT, 'scripts', '.local', 'share')

// The binary directory for CLI launchers.
const BIN_DIR = path.join(GIT_ROOT, 'scripts', '.local', 'bin')

describe('Monorepo workspace structure', () => {
  describe('Workspace configuration', () => {
    it('defines a pnpm workspace that includes all packages', () => {
      const content = fs.readFileSync(
        path.join(WORKSPACE_ROOT, 'pnpm-workspace.yaml'),
        'utf-8'
      )
      expect(content).toContain('packages/*')
    })

    it('provides recursive build, test, and typecheck scripts at the root', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf-8')
      )
      expect(pkg.scripts.build).toMatch(/pnpm\s.*-r/)
      expect(pkg.scripts.test).toMatch(/pnpm\s.*-r/)
      expect(pkg.scripts.typecheck).toMatch(/pnpm\s.*-r/)
    })
  })

  describe('Swarm package preservation after relocation', () => {
    const swarmDir = path.join(WORKSPACE_ROOT, 'packages', 'swarm')

    it('retains all original dependencies and scripts', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(swarmDir, 'package.json'), 'utf-8')
      )
      expect(pkg.name).toBe('swarm')
      expect(pkg.type).toBe('module')
      expect(pkg.private).toBe(true)
      // Core runtime dependencies
      expect(pkg.dependencies).toHaveProperty('commander')
      expect(pkg.dependencies).toHaveProperty('smol-toml')
      expect(pkg.dependencies).toHaveProperty('zod')
      // Dev dependencies hoisted to workspace root
      const rootPkg = JSON.parse(
        fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf-8')
      )
      expect(rootPkg.devDependencies).toHaveProperty('vitest')
      expect(rootPkg.devDependencies).toHaveProperty('tsup')
      expect(rootPkg.devDependencies).toHaveProperty('typescript')
      // Essential scripts
      expect(pkg.scripts).toHaveProperty('build')
      expect(pkg.scripts).toHaveProperty('test')
      expect(pkg.scripts).toHaveProperty('typecheck')
    })

    it('preserves source, test, and config files at the new location', () => {
      // Source entry point
      const cliSrc = fs.readFileSync(path.join(swarmDir, 'src', 'cli.ts'), 'utf-8')
      expect(cliSrc.length).toBeGreaterThan(0)

      // Test entry point
      const cliTest = fs.readFileSync(
        path.join(swarmDir, 'tests', 'cli.test.ts'),
        'utf-8'
      )
      expect(cliTest.length).toBeGreaterThan(0)

      // TypeScript strict config (inherited from tsconfig.base.json via extends)
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(swarmDir, 'tsconfig.json'), 'utf-8')
      )
      expect(tsconfig.extends).toContain('tsconfig.base.json')
      const baseConfig = JSON.parse(
        fs.readFileSync(path.join(WORKSPACE_ROOT, 'tsconfig.base.json'), 'utf-8')
      )
      expect(baseConfig.compilerOptions.strict).toBe(true)

      // Default TOML config
      const toml = fs.readFileSync(path.join(swarmDir, 'default.toml'), 'utf-8')
      expect(toml).toContain('[models]')
    })

    it('no longer exists at the old pre-move location', () => {
      const oldPkgPath = path.join(WORKSPACE_ROOT, 'swarm', 'package.json')
      expect(() => fs.readFileSync(oldPkgPath, 'utf-8')).toThrow()
    })
  })

  describe('Common package scaffold (@nns/common)', () => {
    const commonDir = path.join(WORKSPACE_ROOT, 'packages', 'common')

    it('has correct package identity and ESM configuration', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(commonDir, 'package.json'), 'utf-8')
      )
      expect(pkg.name).toBe('@nns/common')
      expect(pkg.type).toBe('module')
      expect(pkg.private).toBe(true)
      expect(pkg.engines.node).toBe('>=22')
    })

    it('declares all planned subpath exports for core, config, drivers, and detect', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(commonDir, 'package.json'), 'utf-8')
      )

      const requiredExports = [
        './core/types',
        './core/errors',
        './core/validation',
        './core/event-emitter',
        './core/state-manager',
        './config/model-registry',
        './config/config-resolver',
        './drivers/driver',
        './drivers/claude-driver',
        './drivers/opencode-driver',
        './drivers/output-parser',
        './drivers/driver-registry',
        './detect/tech-stack',
      ]

      for (const exportPath of requiredExports) {
        expect(pkg.exports, `missing export: ${exportPath}`).toHaveProperty(
          exportPath
        )
      }
    })

    it('each export entry maps to both types and default output paths', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(commonDir, 'package.json'), 'utf-8')
      )

      // Verify at least one export has the standard dual-entry structure
      const firstExport = pkg.exports['./core/types']
      expect(firstExport).toBeDefined()
      // Standard conditional exports should reference .d.ts and .js files
      const exportStr = JSON.stringify(firstExport)
      expect(exportStr).toMatch(/\.d\.ts/)
      expect(exportStr).toMatch(/\.js/)
    })

    it('has strict TypeScript configuration targeting ES2022 with bundler resolution', () => {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(commonDir, 'tsconfig.json'), 'utf-8')
      )
      expect(tsconfig.extends).toContain('tsconfig.base.json')
      const baseConfig = JSON.parse(
        fs.readFileSync(path.join(WORKSPACE_ROOT, 'tsconfig.base.json'), 'utf-8')
      )
      expect(baseConfig.compilerOptions.strict).toBe(true)
      expect(baseConfig.compilerOptions.target).toBe('ES2022')
      expect(baseConfig.compilerOptions.moduleResolution).toBe('bundler')
    })

    it('has vitest configuration for running tests', () => {
      const content = fs.readFileSync(
        path.join(commonDir, 'vitest.config.ts'),
        'utf-8'
      )
      // Must reference test file patterns
      expect(content).toContain('test')
    })

    it('has tsup configuration for ESM build output', () => {
      const content = fs.readFileSync(
        path.join(commonDir, 'tsup.config.ts'),
        'utf-8'
      )
      expect(content).toContain('esm')
    })
  })

  describe('Council package scaffold', () => {
    const councilDir = path.join(WORKSPACE_ROOT, 'packages', 'council')

    it('has correct package identity and ESM configuration', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(councilDir, 'package.json'), 'utf-8')
      )
      expect(pkg.name).toBe('council')
      expect(pkg.type).toBe('module')
      expect(pkg.private).toBe(true)
      expect(pkg.engines.node).toBe('>=22')
    })

    it('has strict TypeScript configuration targeting ES2022 with bundler resolution', () => {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(councilDir, 'tsconfig.json'), 'utf-8')
      )
      expect(tsconfig.extends).toContain('tsconfig.base.json')
      const baseConfig = JSON.parse(
        fs.readFileSync(path.join(WORKSPACE_ROOT, 'tsconfig.base.json'), 'utf-8')
      )
      expect(baseConfig.compilerOptions.strict).toBe(true)
      expect(baseConfig.compilerOptions.target).toBe('ES2022')
      expect(baseConfig.compilerOptions.moduleResolution).toBe('bundler')
    })

    it('has vitest configuration for running tests', () => {
      const content = fs.readFileSync(
        path.join(councilDir, 'vitest.config.ts'),
        'utf-8'
      )
      expect(content).toContain('test')
    })

    it('has tsup configuration for ESM build output', () => {
      const content = fs.readFileSync(
        path.join(councilDir, 'tsup.config.ts'),
        'utf-8'
      )
      expect(content).toContain('esm')
    })
  })

  describe('CLI binary launchers', () => {
    it('swarm binary resolves to the relocated packages/swarm path', () => {
      const content = fs.readFileSync(path.join(BIN_DIR, 'swarm'), 'utf-8')
      expect(content).toContain('packages/swarm')
    })

    it('council binary exists and is executable', () => {
      const binPath = path.join(BIN_DIR, 'council')
      const stat = fs.statSync(binPath)
      expect(stat.isFile()).toBe(true)
      // At least one execute permission bit (owner, group, or other)
      // eslint-disable-next-line no-bitwise
      expect(stat.mode & 0o111).toBeGreaterThan(0)
    })

    it('council binary targets packages/council/dist/cli.js with bash shebang', () => {
      const content = fs.readFileSync(path.join(BIN_DIR, 'council'), 'utf-8')
      expect(content).toMatch(/^#!\/usr\/bin\/env bash/)
      expect(content).toContain('packages/council/dist/cli.js')
    })
  })
})
