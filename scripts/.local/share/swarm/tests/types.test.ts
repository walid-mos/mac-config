import { describe, it, expect } from 'vitest'
import { createSessionId, assertNever } from '../src/types.js'

// ---------------------------------------------------------------------------
// createSessionId — branded type constructor with validation
// ---------------------------------------------------------------------------

describe('createSessionId', () => {
  describe('valid inputs', () => {
    it('accepts a simple alphanumeric string', () => {
      const id = createSessionId('my-session-01')

      expect(id).toBe('my-session-01')
    })

    it('accepts underscores and hyphens', () => {
      const id = createSessionId('feat_add-feature')

      expect(id).toBe('feat_add-feature')
    })

    it('accepts a single character', () => {
      const id = createSessionId('a')

      expect(id).toBe('a')
    })

    it('accepts the maximum length of 64 characters', () => {
      const raw = 'a'.repeat(64)

      const id = createSessionId(raw)

      expect(id).toBe(raw)
    })
  })

  describe('invalid inputs', () => {
    it('rejects an empty string with a validation error (not "Not implemented")', () => {
      expect(() => createSessionId('')).toThrow()
      // Must NOT be the stub error — it must be a real validation error
      try {
        createSessionId('')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects a string exceeding 64 characters with a validation error', () => {
      const tooLong = 'a'.repeat(65)

      expect(() => createSessionId(tooLong)).toThrow()
      try {
        createSessionId(tooLong)
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects special characters (dots) with a validation error', () => {
      expect(() => createSessionId('my.session')).toThrow()
      try {
        createSessionId('my.session')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects spaces with a validation error', () => {
      expect(() => createSessionId('my session')).toThrow()
      try {
        createSessionId('my session')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects path traversal characters (forward slash)', () => {
      expect(() => createSessionId('../etc/passwd')).toThrow()
      try {
        createSessionId('../etc/passwd')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects path traversal characters (backslash)', () => {
      expect(() => createSessionId('..\\windows')).toThrow()
      try {
        createSessionId('..\\windows')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects null bytes', () => {
      expect(() => createSessionId('session\0id')).toThrow()
      try {
        createSessionId('session\0id')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })

    it('rejects unicode characters', () => {
      expect(() => createSessionId('session-\u00e9')).toThrow()
      try {
        createSessionId('session-\u00e9')
      } catch (err) {
        expect((err as Error).message).not.toBe('Not implemented')
      }
    })
  })
})

// ---------------------------------------------------------------------------
// assertNever — exhaustiveness helper (already implemented in types.ts)
// ---------------------------------------------------------------------------

describe('assertNever', () => {
  it('throws when called with any value', () => {
    // assertNever is meant to be unreachable at compile time,
    // but at runtime it must throw if ever reached
    expect(() => assertNever('unexpected' as never)).toThrow()
  })

  it('includes the value in the error message by default', () => {
    expect(() => assertNever('oops' as never)).toThrow('oops')
  })

  it('uses a custom message when provided', () => {
    expect(() => assertNever('oops' as never, 'Custom error')).toThrow(
      'Custom error'
    )
  })
})
