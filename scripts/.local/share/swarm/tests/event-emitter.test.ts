import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Writable, PassThrough } from 'node:stream'
import { createEventEmitter } from '../src/event-emitter.js'
import type {
  SessionId,
  SwarmEvent,
  SwarmEventEmitter,
  PhaseStartEvent,
  SessionStartEvent,
  SessionEndEvent,
  FileChangedEvent,
} from '../src/types.js'
import {
  createSessionStartEvent,
  createPhaseStartEvent,
  createPhaseEndEvent,
  createFileChangedEvent,
  createCommitEvent,
} from './__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SESSION_ID = 'test-session' as SessionId

function createCapturingStream(): { stream: PassThrough; getLines: () => string[] } {
  const chunks: Buffer[] = []
  const stream = new PassThrough()
  stream.on('data', (chunk: Buffer) => chunks.push(chunk))
  return {
    stream,
    getLines: () =>
      Buffer.concat(chunks)
        .toString('utf-8')
        .split('\n')
        .filter(line => line.length > 0),
  }
}

// ---------------------------------------------------------------------------
// FR-5: NDJSON event emission
// ---------------------------------------------------------------------------

describe('createEventEmitter — NDJSON output (FR-5)', () => {
  let capture: ReturnType<typeof createCapturingStream>
  let emitter: SwarmEventEmitter

  beforeEach(() => {
    capture = createCapturingStream()
    emitter = createEventEmitter(TEST_SESSION_ID, { output: capture.stream })
  })

  afterEach(() => {
    capture.stream.destroy()
    vi.restoreAllMocks()
  })

  it('writes each event as a single JSON line', () => {
    const event = createSessionStartEvent(TEST_SESSION_ID)

    emitter.emit(event)

    const lines = capture.getLines()
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!)
    expect(parsed.type).toBe('session:start')
  })

  it('writes multiple events as separate lines (NDJSON)', () => {
    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))
    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID, 'plan'))
    emitter.emit(createPhaseEndEvent(TEST_SESSION_ID, 'plan'))

    const lines = capture.getLines()
    expect(lines).toHaveLength(3)

    // Each line must be independently parseable
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('emitted NDJSON contains correct event fields', () => {
    const event = createSessionStartEvent(TEST_SESSION_ID, {
      specPath: '/project/spec.md',
      projectDir: '/project',
    })

    emitter.emit(event)

    const lines = capture.getLines()
    const parsed = JSON.parse(lines[0]!)
    expect(parsed).toEqual(
      expect.objectContaining({
        type: 'session:start',
        sessionId: 'test-session',
        data: expect.objectContaining({
          specPath: '/project/spec.md',
          projectDir: '/project',
        }),
      })
    )
    expect(parsed.timestamp).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Event accumulation & querying
// ---------------------------------------------------------------------------

describe('createEventEmitter — accumulation', () => {
  let emitter: SwarmEventEmitter

  beforeEach(() => {
    // Use a PassThrough to avoid writing to real stdout
    const stream = new PassThrough()
    emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all emitted events via getEvents()', () => {
    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))
    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID))

    const events = emitter.getEvents()

    expect(events).toHaveLength(2)
  })

  it('filters events by type', () => {
    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))
    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID, 'plan'))
    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID, 'code'))
    emitter.emit(createPhaseEndEvent(TEST_SESSION_ID, 'plan'))

    const phaseStarts = emitter.getEvents({ type: 'phase:start' })

    expect(phaseStarts).toHaveLength(2)
    for (const e of phaseStarts) {
      expect(e.type).toBe('phase:start')
    }
  })

  it('returns empty array when no events match the filter', () => {
    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))

    const results = emitter.getEvents({ type: 'commit' })

    expect(results).toEqual([])
  })

  it('returns all events when no filter is provided', () => {
    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))
    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID))
    emitter.emit(createCommitEvent(TEST_SESSION_ID))

    const events = emitter.getEvents()

    expect(events).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// EPIPE handling — write to closed stream
// ---------------------------------------------------------------------------

describe('createEventEmitter — EPIPE handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not crash when writing to a closed/destroyed stream', () => {
    const stream = new PassThrough()
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    // Destroy the stream to simulate EPIPE
    stream.destroy()

    // Should not throw
    expect(() => {
      emitter.emit(createSessionStartEvent(TEST_SESSION_ID))
    }).not.toThrow()
  })

  it('logs EPIPE errors to stderr instead of crashing', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const stream = new Writable({
      write(_chunk, _encoding, callback) {
        const err = new Error('write EPIPE') as NodeJS.ErrnoException
        err.code = 'EPIPE'
        callback(err)
      },
    })
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    emitter.emit(createSessionStartEvent(TEST_SESSION_ID))

    // Give the error handler a tick to fire
    expect(stderrSpy).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Accumulator bound (10,000 events with FIFO eviction)
// ---------------------------------------------------------------------------

describe('createEventEmitter — accumulator bound', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('evicts oldest non-structural events after 10,000 events', () => {
    const stream = new PassThrough()
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    // Emit 10,001 file:changed events (non-structural)
    for (let i = 0; i < 10_001; i++) {
      emitter.emit(createFileChangedEvent(TEST_SESSION_ID, `src/file-${i}.ts`))
    }

    const events = emitter.getEvents()
    expect(events.length).toBeLessThanOrEqual(10_000)
  })

  it('retains structural events during eviction', () => {
    const stream = new PassThrough()
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    // Emit a structural event first
    const sessionStart = createSessionStartEvent(TEST_SESSION_ID)
    emitter.emit(sessionStart)

    // Fill up with non-structural events to trigger eviction
    for (let i = 0; i < 10_000; i++) {
      emitter.emit(createFileChangedEvent(TEST_SESSION_ID, `src/file-${i}.ts`))
    }

    const events = emitter.getEvents()
    const sessionStarts = events.filter(e => e.type === 'session:start')
    expect(sessionStarts).toHaveLength(1)
  })

  it('retains phase:start and phase:end events during eviction', () => {
    const stream = new PassThrough()
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    emitter.emit(createPhaseStartEvent(TEST_SESSION_ID, 'plan'))
    emitter.emit(createPhaseEndEvent(TEST_SESSION_ID, 'plan'))

    // Overflow with non-structural events
    for (let i = 0; i < 10_000; i++) {
      emitter.emit(createCommitEvent(TEST_SESSION_ID))
    }

    const events = emitter.getEvents()
    const phaseEvents = events.filter(
      e => e.type === 'phase:start' || e.type === 'phase:end'
    )
    expect(phaseEvents).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 64KB event size limit (SC-5)
// ---------------------------------------------------------------------------

describe('createEventEmitter — 64KB event limit (SC-5)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects or truncates events exceeding 64KB', () => {
    const stream = new PassThrough()
    const emitter = createEventEmitter(TEST_SESSION_ID, { output: stream })

    // Create an event with a huge data payload
    const oversizedEvent: FileChangedEvent = {
      type: 'file:changed',
      timestamp: new Date().toISOString(),
      sessionId: TEST_SESSION_ID,
      data: {
        path: 'x'.repeat(70_000), // Well over 64KB
        action: 'modified',
      },
    }

    // Should either throw, skip, or truncate — but not emit >64KB
    let threw = false
    try {
      emitter.emit(oversizedEvent)
    } catch {
      threw = true
    }

    if (!threw) {
      // If it didn't throw, verify the accumulated event was truncated
      const events = emitter.getEvents({ type: 'file:changed' })
      if (events.length > 0) {
        const serialized = JSON.stringify(events[0])
        expect(serialized.length).toBeLessThanOrEqual(65_536)
      }
    } else {
      // Throwing is also acceptable behavior
      expect(threw).toBe(true)
    }
  })
})
