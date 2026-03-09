// src/core/event-emitter.ts
var MAX_EVENTS = 1e4;
var MAX_EVENT_SIZE = 65536;
var STRUCTURAL_TYPES = /* @__PURE__ */ new Set([
  "session:start",
  "session:end",
  "session:error",
  "phase:start",
  "phase:end"
]);
function createEventEmitter(_sessionId, options) {
  const output = options?.output ?? process.stdout;
  const events = [];
  output.on("error", (err) => {
    process.stderr.write(`Event emitter stream error: ${err.code ?? err.message}
`);
  });
  function emit(event) {
    const serialized = JSON.stringify(event);
    if (serialized.length > MAX_EVENT_SIZE) {
      throw new Error(
        `Event exceeds 64KB limit (${serialized.length} bytes): ${event.type}`
      );
    }
    try {
      output.write(serialized + "\n");
      const writableStream = output;
      if (writableStream.errored) {
        const errored = writableStream.errored;
        process.stderr.write(
          `Event write error: ${errored.code ?? errored.message}
`
        );
      }
    } catch (err) {
      process.stderr.write(
        `Failed to write event: ${err.code ?? err.message}
`
      );
    }
    events.push(event);
    if (events.length > MAX_EVENTS) {
      evictOldest(events);
    }
  }
  function getEvents(filter) {
    if (!filter?.type) {
      return [...events];
    }
    return events.filter((e) => e.type === filter.type);
  }
  return { emit, getEvents };
}
function evictOldest(events) {
  for (let i = 0; i < events.length; i++) {
    if (!STRUCTURAL_TYPES.has(events[i].type)) {
      events.splice(i, 1);
      return;
    }
  }
  events.shift();
}
export {
  createEventEmitter
};
