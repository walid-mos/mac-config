// src/core/types.ts
var MODEL_ID_RE = /^[a-zA-Z0-9._\/-]{1,64}$/;
function createModelId(raw) {
  if (!MODEL_ID_RE.test(raw)) {
    throw new Error(
      `Invalid model ID "${raw}": must match /^[a-zA-Z0-9._\\/-]{1,64}$/`
    );
  }
  return raw;
}
var SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
function createSessionId(raw) {
  if (!SESSION_ID_RE.test(raw)) {
    throw new Error(
      `Invalid session ID "${raw}": must match /^[a-zA-Z0-9_-]{1,64}$/`
    );
  }
  return raw;
}
var AGENT_ROLES = ["plan", "test", "code", "review", "security", "consistency", "merge", "docs"];
var PHASES = ["init", "plan", "tdd", "code", "review", "commit", "docs"];
function assertNever(x, message) {
  throw new Error(message ?? `Unexpected value: ${x}`);
}

export {
  createModelId,
  createSessionId,
  AGENT_ROLES,
  PHASES,
  assertNever
};
