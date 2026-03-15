import * as fs from 'node:fs'
import * as path from 'node:path'

const SYSTEM_ROOTS = new Set(['/', '/etc', '/var', '/usr', '/private/etc', '/private/var'])

export const validateProjectDir = (dir: string): void => {
  const canonical = fs.realpathSync(dir)
  if (SYSTEM_ROOTS.has(canonical)) {
    throw new Error(`Project directory must not be a system root: ${canonical}`)
  }

  const stat = fs.statSync(canonical)
  if (!stat.isDirectory()) {
    throw new Error(`Project directory is not a directory: ${canonical}`)
  }
}

export const validateSpecContainment = (specPath: string, projectDir: string): void => {
  const canonicalSpec = fs.realpathSync(specPath)
  const canonicalProject = fs.realpathSync(projectDir)
  if (!canonicalSpec.startsWith(canonicalProject + path.sep)) {
    throw new Error(`Spec file "${canonicalSpec}" is not under project directory "${canonicalProject}"`)
  }
}
