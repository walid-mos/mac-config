import { describe, it, expect } from 'vitest'
import { verifyFileContainment, checkStagingBlocklist } from '../../../src/phases/code/file-verification.js'

// ---------------------------------------------------------------------------
// verifyFileContainment
// ---------------------------------------------------------------------------

describe('verifyFileContainment', () => {
  const projectDir = '/tmp/project'

  it('passes for files under projectDir', () => {
    const assigned = ['src/a.ts', 'src/b.ts']
    const actual = ['/tmp/project/src/a.ts', '/tmp/project/src/b.ts']

    const result = verifyFileContainment(projectDir, assigned, actual)

    expect(result.violations).toHaveLength(0)
  })

  it('reports violations for files outside projectDir', () => {
    const assigned = ['src/a.ts']
    const actual = ['/tmp/project/src/a.ts', '/etc/passwd']

    const result = verifyFileContainment(projectDir, assigned, actual)

    expect(result.violations).toContain('/etc/passwd')
  })

  it('flags CI-sensitive files not in assigned list', () => {
    const assigned = ['src/a.ts']
    const actual = ['/tmp/project/src/a.ts', '/tmp/project/.github/workflows/ci.yml']

    const result = verifyFileContainment(projectDir, assigned, actual)

    expect(result.ciSensitive.length).toBeGreaterThan(0)
  })

  it('allows CI-sensitive files when in assigned list', () => {
    const assigned = ['src/a.ts', '.github/workflows/ci.yml']
    const actual = ['/tmp/project/src/a.ts', '/tmp/project/.github/workflows/ci.yml']

    const result = verifyFileContainment(projectDir, assigned, actual)

    expect(result.ciSensitive).toHaveLength(0)
  })

  it('returns empty results for empty inputs', () => {
    const result = verifyFileContainment(projectDir, [], [])

    expect(result.violations).toHaveLength(0)
    expect(result.ciSensitive).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// checkStagingBlocklist
// ---------------------------------------------------------------------------

describe('checkStagingBlocklist', () => {
  it('allows safe files', () => {
    const files = ['src/index.ts', 'package.json', 'tsconfig.json']

    const result = checkStagingBlocklist(files)

    expect(result.allowed).toEqual(files)
    expect(result.blocked).toHaveLength(0)
  })

  it('blocks .env files', () => {
    const files = ['.env', '.env.local', '.env.production']

    const result = checkStagingBlocklist(files)

    expect(result.blocked).toEqual(files)
    expect(result.allowed).toHaveLength(0)
  })

  it('blocks *.pem, *.key, *.p12, *.pfx, *.jks files', () => {
    const files = [
      'server.pem',
      'private.key',
      'cert.p12',
      'keystore.pfx',
      'keystore.jks',
    ]

    const result = checkStagingBlocklist(files)

    expect(result.blocked).toEqual(files)
    expect(result.allowed).toHaveLength(0)
  })

  it('blocks *credential*, *.secret, id_rsa*, .npmrc, .netrc files', () => {
    const files = [
      'db-credentials.json',
      'api.secret',
      'id_rsa',
      'id_rsa.pub',
      '.npmrc',
      '.netrc',
    ]

    const result = checkStagingBlocklist(files)

    expect(result.blocked).toEqual(files)
    expect(result.allowed).toHaveLength(0)
  })

  it('returns empty result for empty input', () => {
    const result = checkStagingBlocklist([])

    expect(result.allowed).toHaveLength(0)
    expect(result.blocked).toHaveLength(0)
  })

  it('correctly partitions mixed files', () => {
    const files = [
      'src/index.ts',
      '.env',
      'package.json',
      'private.key',
      'README.md',
    ]

    const result = checkStagingBlocklist(files)

    expect(result.allowed).toEqual(['src/index.ts', 'package.json', 'README.md'])
    expect(result.blocked).toEqual(['.env', 'private.key'])
  })
})
