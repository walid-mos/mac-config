// === File Verification (Spec 4 — FR-14, FR-17) ===

import * as path from 'node:path'
import type { FileContainmentResult, StagingCheckResult } from './phase-results.js'

// === Constants ===

const CI_SENSITIVE_PATTERNS = [
  /^\.github\//,
  /^\.gitlab-ci\.yml$/,
  /^Dockerfile$/,
  /^docker-compose/,
]

const BLOCKLIST_PATTERNS = [
  /^\.env($|\.)/, // .env, .env.local, .env.production, etc.
  /\.pem$/,
  /\.key$/,
  /credential/i,
  /\.secret$/,
  /^id_rsa/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /\.p12$/,
  /\.pfx$/,
  /\.jks$/,
]

// === API ===

export function verifyFileContainment(
  projectDir: string,
  assignedFiles: string[],
  actualFiles: string[]
): FileContainmentResult {
  const resolvedProjectDir = path.resolve(projectDir)
  const assignedSet = new Set(assignedFiles)
  const violations: string[] = []
  const ciSensitive: string[] = []

  for (const file of actualFiles) {
    const resolvedFile = path.resolve(file)

    // Check if file is outside project directory
    if (!resolvedFile.startsWith(resolvedProjectDir + path.sep) && resolvedFile !== resolvedProjectDir) {
      violations.push(file)
      continue
    }

    // Get relative path for CI-sensitive check
    const relativePath = path.relative(resolvedProjectDir, resolvedFile)

    // Check if file is CI-sensitive and NOT in assigned list
    if (!assignedSet.has(relativePath)) {
      for (const pattern of CI_SENSITIVE_PATTERNS) {
        if (pattern.test(relativePath)) {
          ciSensitive.push(file)
          break
        }
      }
    }
  }

  return { violations, ciSensitive }
}

export function checkStagingBlocklist(files: string[]): StagingCheckResult {
  const allowed: string[] = []
  const blocked: string[] = []

  for (const file of files) {
    const basename = path.basename(file)
    let isBlocked = false

    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(basename)) {
        isBlocked = true
        break
      }
    }

    if (isBlocked) {
      blocked.push(file)
    } else {
      allowed.push(file)
    }
  }

  return { allowed, blocked }
}
