import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  EventCorrelation,
  SessionId,
  SwarmEvent,
  SwarmEventEmitter,
  SwarmEventType,
} from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 10_000
const MAX_EVENT_SIZE = 65_536 // 64KB

const STRUCTURAL_TYPES: ReadonlySet<SwarmEventType> = new Set([
  'session:start',
  'session:end',
  'session:error',
  'phase:start',
  'phase:end',
])

// ---------------------------------------------------------------------------
// createEventEmitter
// ---------------------------------------------------------------------------

export function createEventEmitter(
  _sessionId: SessionId,
  options?: { output?: NodeJS.WritableStream; logFilePath?: string }
): SwarmEventEmitter {
  const output = options?.output ?? process.stdout
  const events: SwarmEvent[] = []
  const logFilePath = options?.logFilePath
  let logFd: number | undefined

  if (logFilePath) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
    logFd = fs.openSync(logFilePath, 'a', 0o600)
  }

  // Install error handler on the output stream to prevent uncaught EPIPE crashes
  output.on('error', (err: NodeJS.ErrnoException) => {
    process.stderr.write(`Event emitter stream error: ${err.code ?? err.message}\n`)
  })

  function emit(event: SwarmEvent): void {
    const serialized = JSON.stringify(event)

    // SC-5: reject events exceeding 64KB
    if (serialized.length > MAX_EVENT_SIZE) {
      throw new Error(
        `Event exceeds 64KB limit (${serialized.length} bytes): ${event.type}`
      )
    }

    // Write NDJSON to output stream
    try {
      output.write(serialized + '\n')
      // Check for synchronous write errors (e.g., EPIPE via sync callback in _write)
      const writableStream = output as NodeJS.WritableStream & { errored?: Error | null }
      if (writableStream.errored) {
        const errored = writableStream.errored as NodeJS.ErrnoException
        process.stderr.write(
          `Event write error: ${errored.code ?? errored.message}\n`
        )
      }
    } catch (err) {
      process.stderr.write(
        `Failed to write event: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}\n`
      )
    }

    if (logFd !== undefined) {
      try {
        fs.writeSync(logFd, serialized + '\n')
      } catch (err) {
        process.stderr.write(
          `Failed to persist event log: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}\n`
        )
      }
    }

    // Accumulate in memory
    events.push(event)

    // Enforce accumulator bound
    if (events.length > MAX_EVENTS) {
      evictOldest(events)
    }
  }

  function getEvents(filter?: { type?: SwarmEventType }): SwarmEvent[] {
    if (!filter?.type) {
      return [...events]
    }
    return events.filter(e => e.type === filter.type)
  }

  return { emit, getEvents }
}

export function emitWarningEvent(
  emitter: SwarmEventEmitter,
  sessionId: SessionId,
  source: string,
  message: string,
  options?: { code?: string; correlation?: EventCorrelation }
): void {
  emitter.emit({
    type: 'warning',
    timestamp: new Date().toISOString(),
    sessionId,
    correlation: options?.correlation,
    data: {
      source,
      message,
      stream: 'stderr',
      code: options?.code,
    },
  })
}

// ---------------------------------------------------------------------------
// Eviction — remove oldest non-structural event (FIFO)
// ---------------------------------------------------------------------------

function evictOldest(events: SwarmEvent[]): void {
  for (let i = 0; i < events.length; i++) {
    if (!STRUCTURAL_TYPES.has(events[i]!.type)) {
      events.splice(i, 1)
      return
    }
  }
  // If all events are structural (extremely unlikely), just remove the oldest
  events.shift()
}
