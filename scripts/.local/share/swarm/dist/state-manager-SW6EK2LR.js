import {
  SwarmStateSchema
} from "./chunk-7OZYOMGU.js";

// src/core/state-manager.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
var MAX_ERRORS = 50;
function createStateManager(sessionId, options) {
  const tmpDir = options?.tmpDir ?? os.tmpdir();
  const stateFile = path.join(tmpDir, `swarm-${sessionId}-state.json`);
  const lockFile = path.join(tmpDir, `swarm-${sessionId}-lock`);
  function save(state) {
    const cappedState = {
      ...state,
      errors: state.errors.length > MAX_ERRORS ? state.errors.slice(-MAX_ERRORS) : state.errors
    };
    const json = JSON.stringify(cappedState, null, 2);
    const tmpPath = stateFile + ".tmp";
    fs.writeFileSync(tmpPath, "", { mode: 384 });
    fs.writeFileSync(tmpPath, json, { mode: 384 });
    try {
      const readBack = fs.readFileSync(tmpPath, "utf-8");
      JSON.parse(readBack);
    } catch (err) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
      }
      throw new Error(
        `State write-back verification failed: ${err.message}`
      );
    }
    fs.renameSync(tmpPath, stateFile);
    fs.chmodSync(stateFile, 384);
  }
  function load() {
    if (!fs.existsSync(stateFile)) {
      return { found: false, reason: "missing" };
    }
    let raw;
    try {
      raw = fs.readFileSync(stateFile, "utf-8");
    } catch {
      return { found: false, reason: "inaccessible" };
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        found: true,
        valid: false,
        error: `Invalid JSON: ${err.message}`
      };
    }
    const result = SwarmStateSchema.safeParse(parsed);
    if (!result.success) {
      return {
        found: true,
        valid: false,
        error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      };
    }
    return {
      found: true,
      valid: true,
      state: result.data
    };
  }
  function acquireLock() {
    try {
      const fd = fs.openSync(lockFile, "wx", 384);
      const lockData2 = JSON.stringify({
        pid: process.pid,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        hostname: os.hostname()
      });
      fs.writeSync(fd, lockData2);
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }
    const lockContent = fs.readFileSync(lockFile, "utf-8");
    let lockData;
    try {
      lockData = JSON.parse(lockContent);
    } catch {
      writeLockFile();
      return;
    }
    if (isPidAlive(lockData.pid)) {
      throw new Error(
        `Session is already running (PID ${lockData.pid}, started at ${lockData.startedAt})`
      );
    }
    process.stderr.write(
      `Warning: overwriting stale lock file (PID ${lockData.pid} is dead)
`
    );
    writeLockFile();
  }
  function writeLockFile() {
    const lockData = JSON.stringify({
      pid: process.pid,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      hostname: os.hostname()
    });
    fs.writeFileSync(lockFile, lockData, { mode: 384 });
  }
  function releaseLock() {
    try {
      fs.unlinkSync(lockFile);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  return { load, save, acquireLock, releaseLock };
}
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
export {
  createStateManager
};
