import {
  extractStreamResult,
  parseStructuredOutput
} from "./chunk-ELEMRGRH.js";
import {
  getModelAssignment
} from "./chunk-SZOPGQT3.js";
import "./chunk-BP3VSFNG.js";
import "./chunk-7OZYOMGU.js";

// src/drivers/claude-driver.ts
import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
var MODEL_RE = /^[a-zA-Z0-9._\/-]{1,64}$/;
var AGENT_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var MIN_TIMEOUT = 1e4;
var MAX_TIMEOUT = 36e5;
var DEFAULT_IDLE_TIMEOUT = 3e5;
var MODEL_INFERENCE_TIMEOUT = 6e5;
var API_WAIT_TIMEOUT = 6e5;
var MAX_RAW_OUTPUT = 1024 * 1024;
var MAX_STDERR = 64 * 1024;
var KILL_GRACE_MS = 5e3;
var AVAILABILITY_TIMEOUT = 1e4;
var SANITIZED_ENV_KEYS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
];
var JSON_DIRECTIVE = "\n\nIMPORTANT: Output ONLY raw JSON matching the provided schema. No markdown fences, no narrative text, no commentary.";
function safeKill(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (err) {
    if (err.code !== "ESRCH") throw err;
  }
}
function truncate(value, max) {
  if (value.length <= max) return value;
  return value.slice(0, max);
}
function validateCommonInputs(request) {
  if (!MODEL_RE.test(request.model)) {
    return `Invalid model: "${request.model}"`;
  }
  if (request.agent !== void 0 && !AGENT_NAME_RE.test(request.agent)) {
    return `Invalid agent name: "${request.agent}"`;
  }
  if (request.schema !== void 0) {
    try {
      JSON.parse(request.schema);
    } catch {
      return `Invalid schema: not valid JSON`;
    }
  }
  try {
    const stat = fs.statSync(request.projectDir);
    if (!stat.isDirectory()) {
      return `projectDir is not a directory: "${request.projectDir}"`;
    }
  } catch {
    return `projectDir is not accessible: "${request.projectDir}"`;
  }
  if (request.timeout !== void 0) {
    if (request.timeout < MIN_TIMEOUT || request.timeout > MAX_TIMEOUT) {
      return `Timeout must be between ${MIN_TIMEOUT}ms and ${MAX_TIMEOUT}ms, got ${request.timeout}ms`;
    }
  }
  if (request.sessionId !== void 0 && request.resume !== void 0) {
    return "sessionId and resume are mutually exclusive \u2014 set one or neither";
  }
  if (request.sessionId !== void 0 && !UUID_RE.test(request.sessionId)) {
    return `Invalid sessionId: must be a UUID, got "${request.sessionId}"`;
  }
  if (request.resume !== void 0 && !UUID_RE.test(request.resume)) {
    return `Invalid resume: must be a UUID, got "${request.resume}"`;
  }
  return null;
}
function createClaudeDriver(emitter) {
  const name = "claude";
  async function invoke(request) {
    const startTime = Date.now();
    const backend = name;
    const model = request.model;
    if (request.signal?.aborted) {
      return {
        success: false,
        errorCode: "aborted",
        error: "Aborted before invocation",
        rawOutput: "",
        stderr: "",
        model,
        backend,
        durationMs: Date.now() - startTime
      };
    }
    const validationError = validateCommonInputs(request);
    if (validationError) {
      return {
        success: false,
        errorCode: "spawn_error",
        error: validationError,
        rawOutput: "",
        stderr: "",
        model,
        backend,
        durationMs: Date.now() - startTime
      };
    }
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
      "--disable-slash-commands",
      "--model",
      String(request.model)
    ];
    if (request.resume) {
      args.push("--resume", request.resume);
    } else if (request.sessionId) {
      args.push("--session-id", request.sessionId);
    } else {
      args.push("--no-session-persistence");
    }
    if (request.agent) {
      args.push("--agent", request.agent);
    }
    if (request.schema) {
      args.push("--json-schema", request.schema);
    }
    const env = { ...process.env };
    for (const key of SANITIZED_ENV_KEYS) {
      delete env[key];
    }
    emitter.emit({
      type: "agent:invoke",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: "driver",
      data: { role: request.role, backend, model: String(model) }
    });
    return new Promise((resolve) => {
      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheCreation = 0;
      let totalCacheRead = 0;
      const buildTokenUsage = () => ({
        input: totalInput,
        output: totalOutput,
        cacheCreation: totalCacheCreation,
        cacheRead: totalCacheRead
      });
      let proc;
      try {
        proc = childProcess.spawn("claude", args, {
          cwd: request.projectDir,
          detached: true,
          stdio: ["pipe", "pipe", "pipe"],
          env
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: "driver",
          data: { role: request.role, reason: err.message }
        });
        resolve({
          success: false,
          errorCode: "spawn_error",
          error: err.message,
          rawOutput: "",
          stderr: "",
          model,
          backend,
          durationMs
        });
        return;
      }
      const logDir = process.env.SWARM_DEBUG_DIR ?? os.tmpdir();
      const logPath = path.join(logDir, `swarm-agent-${request.role}-${proc.pid}.ndjson`);
      let logFd;
      try {
        logFd = fs.openSync(logPath, "w", 384);
      } catch {
      }
      const promptContent = request.schema ? request.prompt + JSON_DIRECTIVE : request.prompt;
      proc.stdin.write(promptContent);
      proc.stdin.end();
      let stdoutBuf = "";
      let stderrBuf = "";
      let lineBuf = "";
      let resultText;
      let killStarted = false;
      let errorCode = "crash";
      let killTimer;
      let idleTimer;
      let resolved = false;
      const doResolve = (result) => {
        if (resolved) return;
        resolved = true;
        if (idleTimer) clearTimeout(idleTimer);
        if (killTimer) clearTimeout(killTimer);
        if (request.signal) {
          try {
            request.signal.removeEventListener("abort", onAbort);
          } catch {
          }
        }
        if (logFd !== void 0) {
          try {
            fs.closeSync(logFd);
          } catch {
          }
        }
        resolve(result);
      };
      const startKillSequence = (code) => {
        if (killStarted) return;
        killStarted = true;
        errorCode = code;
        if (proc.pid !== void 0) {
          try {
            proc.stdin.destroy();
          } catch {
          }
          safeKill(proc.pid, "SIGTERM");
          killTimer = setTimeout(() => {
            if (proc.pid !== void 0) {
              safeKill(proc.pid, "SIGKILL");
            }
          }, KILL_GRACE_MS);
        }
      };
      const idleTimeout = request.timeout ?? DEFAULT_IDLE_TIMEOUT;
      let agentWorking = false;
      let awaitingModelResponse = false;
      const resetIdleTimer = () => {
        if (killStarted) return;
        if (idleTimer) clearTimeout(idleTimer);
        let timeout;
        if (!agentWorking) {
          timeout = API_WAIT_TIMEOUT;
        } else if (awaitingModelResponse) {
          timeout = MODEL_INFERENCE_TIMEOUT;
        } else {
          timeout = idleTimeout;
        }
        idleTimer = setTimeout(() => {
          startKillSequence("timeout");
        }, timeout);
      };
      resetIdleTimer();
      const onAbort = () => {
        startKillSequence("aborted");
      };
      if (request.signal) {
        request.signal.addEventListener("abort", onAbort, { once: true });
      }
      const processLine = (line) => {
        if (logFd !== void 0) {
          try {
            fs.writeSync(logFd, line + "\n");
          } catch {
          }
        }
        try {
          const event = JSON.parse(line);
          if (!agentWorking && (event.type === "assistant" || event.type === "result")) {
            agentWorking = true;
          }
          if (event.type === "user") {
            awaitingModelResponse = true;
          } else if (event.type === "assistant" || event.type === "result") {
            awaitingModelResponse = false;
          }
          if (event.type === "assistant" && event.message?.usage) {
            const usage = event.message.usage;
            totalInput += usage.input_tokens ?? 0;
            totalOutput += usage.output_tokens ?? 0;
            totalCacheCreation += usage.cache_creation_input_tokens ?? 0;
            totalCacheRead += usage.cache_read_input_tokens ?? 0;
          }
          if (event.type === "result" && event.result !== void 0) {
            resultText = typeof event.result === "string" ? event.result : JSON.stringify(event.result);
          }
          if (event.type === "assistant" && event.message?.type === "tool_use") {
            emitter.emit({
              type: "agent:activity",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              sessionId: "driver",
              data: { role: request.role, tool: event.message.name ?? "unknown" }
            });
          }
        } catch {
        }
      };
      proc.stdout.on("data", (chunk) => {
        const data = chunk.toString();
        stdoutBuf += data;
        lineBuf += data;
        let newlineIdx;
        while ((newlineIdx = lineBuf.indexOf("\n")) !== -1) {
          const line = lineBuf.slice(0, newlineIdx).trim();
          lineBuf = lineBuf.slice(newlineIdx + 1);
          if (!line) continue;
          processLine(line);
          resetIdleTimer();
        }
      });
      proc.stderr.on("data", (chunk) => {
        stderrBuf += chunk.toString();
        resetIdleTimer();
      });
      proc.on("error", (err) => {
        const durationMs = Date.now() - startTime;
        const tokenUsage = buildTokenUsage();
        emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: "driver",
          data: { role: request.role, reason: err.message, tokenUsage }
        });
        doResolve({
          success: false,
          errorCode: "spawn_error",
          error: err.message,
          rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
          stderr: truncate(stderrBuf, MAX_STDERR),
          model,
          backend,
          durationMs,
          tokenUsage
        });
      });
      proc.on("close", (exitCode) => {
        const durationMs = Date.now() - startTime;
        const remaining = lineBuf.trim();
        if (remaining) {
          processLine(remaining);
        }
        if (killStarted) {
          const stderrSnippet = stderrBuf.trim().slice(0, 500);
          const reason = stderrSnippet ? `Process ${errorCode} after ${durationMs}ms \u2014 stderr: ${stderrSnippet}` : `Process ${errorCode} after ${durationMs}ms`;
          const tokenUsage2 = buildTokenUsage();
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason, tokenUsage: tokenUsage2 }
          });
          doResolve({
            success: false,
            errorCode,
            error: reason,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage: tokenUsage2
          });
          return;
        }
        if (exitCode !== 0 && exitCode !== null) {
          const stderrSnippet = stderrBuf.trim().slice(0, 500);
          const reason = stderrSnippet ? `Process exited with code ${exitCode}: ${stderrSnippet}` : `Process exited with code ${exitCode}`;
          const tokenUsage2 = buildTokenUsage();
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason, tokenUsage: tokenUsage2 }
          });
          doResolve({
            success: false,
            errorCode: "crash",
            error: reason,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage: tokenUsage2
          });
          return;
        }
        if (stdoutBuf.trim() === "") {
          const tokenUsage2 = buildTokenUsage();
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason: "Empty output from backend", tokenUsage: tokenUsage2 }
          });
          doResolve({
            success: false,
            errorCode: "empty_output",
            error: "Backend produced empty output",
            rawOutput: "",
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage: tokenUsage2
          });
          return;
        }
        if (!resultText) {
          const fallback = extractStreamResult(stdoutBuf);
          if (fallback.ok) {
            resultText = fallback.output;
          }
        }
        const tokenUsage = buildTokenUsage();
        if (resultText !== void 0 && resultText.trim() !== "") {
          emitter.emit({
            type: "agent:result",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, durationMs, tokenUsage }
          });
          const successResult = {
            success: true,
            output: resultText,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage
          };
          const echoSessionId = request.sessionId ?? request.resume;
          if (echoSessionId) {
            successResult.sessionId = echoSessionId;
          }
          doResolve(successResult);
        } else {
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason: "No result event in stream output", tokenUsage }
          });
          doResolve({
            success: false,
            errorCode: "invalid_json",
            error: "No result event found in stream-json output",
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage
          });
        }
      });
    });
  }
  async function checkAvailability() {
    return new Promise((resolve) => {
      let resolved = false;
      let stdoutBuf = "";
      let timeoutTimer;
      const doResolve = (result) => {
        if (resolved) return;
        resolved = true;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        resolve(result);
      };
      const proc = childProcess.spawn("claude", ["--version"], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      timeoutTimer = setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {
        }
        doResolve({ available: false, error: "claude --version timed out" });
      }, AVAILABILITY_TIMEOUT);
      proc.stdout.on("data", (chunk) => {
        stdoutBuf += chunk.toString();
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          doResolve({ available: false, error: "claude not found in PATH" });
        } else {
          doResolve({ available: false, error: err.message });
        }
      });
      proc.on("close", () => {
        const version = stdoutBuf.trim();
        if (version.length > 0) {
          doResolve({ available: true, version });
        } else {
          doResolve({ available: false, error: "claude --version produced no output" });
        }
      });
    });
  }
  return { name, invoke, checkAvailability };
}

// src/drivers/opencode-driver.ts
import * as childProcess2 from "child_process";
import * as fs2 from "fs";
import * as path2 from "path";
var MODEL_RE2 = /^[a-zA-Z0-9._\/-]{1,64}$/;
var AGENT_NAME_RE2 = /^[a-zA-Z0-9_-]{1,64}$/;
var MIN_TIMEOUT2 = 1e4;
var MAX_TIMEOUT2 = 36e5;
var DEFAULT_TIMEOUT = 6e5;
var MAX_RAW_OUTPUT2 = 1024 * 1024;
var MAX_STDERR2 = 64 * 1024;
var KILL_GRACE_MS2 = 5e3;
var AVAILABILITY_TIMEOUT2 = 1e4;
var ALLOWED_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]"]);
var ALLOWED_HOST_PREFIXES = [
  "localhost:",
  "localhost/",
  "localhost",
  "127.0.0.1:",
  "127.0.0.1/",
  "127.0.0.1",
  "[::1]:",
  "[::1]/",
  "[::1]"
];
var JSON_DIRECTIVE2 = "\n\nIMPORTANT: Output ONLY raw JSON matching the provided schema. No markdown fences, no narrative text, no commentary.";
function safeKill2(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (err) {
    if (err.code !== "ESRCH") throw err;
  }
}
function truncate2(value, max) {
  if (value.length <= max) return value;
  return value.slice(0, max);
}
function validateCommonInputs2(request) {
  if (!MODEL_RE2.test(request.model)) {
    return `Invalid model: "${request.model}"`;
  }
  if (request.agent !== void 0 && !AGENT_NAME_RE2.test(request.agent)) {
    return `Invalid agent name: "${request.agent}"`;
  }
  if (request.schema !== void 0) {
    try {
      JSON.parse(request.schema);
    } catch {
      return `Invalid schema: not valid JSON`;
    }
  }
  try {
    const stat = fs2.statSync(request.projectDir);
    if (!stat.isDirectory()) {
      return `projectDir is not a directory: "${request.projectDir}"`;
    }
  } catch {
    return `projectDir is not accessible: "${request.projectDir}"`;
  }
  if (request.timeout !== void 0) {
    if (request.timeout < MIN_TIMEOUT2 || request.timeout > MAX_TIMEOUT2) {
      return `Timeout must be between ${MIN_TIMEOUT2}ms and ${MAX_TIMEOUT2}ms, got ${request.timeout}ms`;
    }
  }
  return null;
}
function validateContextFiles(files, projectDir) {
  for (const filePath of files) {
    let canonical;
    try {
      canonical = fs2.realpathSync(filePath);
    } catch {
      return `Context file not accessible: "${filePath}"`;
    }
    const normalizedProjectDir = projectDir.endsWith(path2.sep) ? projectDir : projectDir + path2.sep;
    if (!canonical.startsWith(normalizedProjectDir) && canonical !== projectDir) {
      return `Context file "${filePath}" resolves outside projectDir`;
    }
  }
  return null;
}
function validateAttachUrl(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return `Invalid URL: "${urlStr}"`;
  }
  if (url.protocol !== "http:") {
    return `Only http: protocol is allowed for attachUrl, got "${url.protocol}"`;
  }
  if (url.username || url.password) {
    return `Credentials are not allowed in attachUrl`;
  }
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
    return `Hostname must be localhost, 127.0.0.1, or [::1], got "${url.hostname}"`;
  }
  const afterProtocol = urlStr.slice("http://".length);
  const hasLiteralHost = ALLOWED_HOST_PREFIXES.some((prefix) => afterProtocol.startsWith(prefix));
  if (!hasLiteralHost) {
    return `Hostname uses an encoded representation not allowed by DS-3: "${urlStr}"`;
  }
  return null;
}
function createOpenCodeDriver(emitter) {
  const name = "opencode";
  async function invoke(request) {
    const startTime = Date.now();
    const backend = name;
    const model = request.model;
    if (request.signal?.aborted) {
      return {
        success: false,
        errorCode: "aborted",
        error: "Aborted before invocation",
        rawOutput: "",
        stderr: "",
        model,
        backend,
        durationMs: Date.now() - startTime
      };
    }
    const validationError = validateCommonInputs2(request);
    if (validationError) {
      return {
        success: false,
        errorCode: "spawn_error",
        error: validationError,
        rawOutput: "",
        stderr: "",
        model,
        backend,
        durationMs: Date.now() - startTime
      };
    }
    if (request.contextFiles && request.contextFiles.length > 0) {
      const contextError = validateContextFiles(request.contextFiles, request.projectDir);
      if (contextError) {
        return {
          success: false,
          errorCode: "spawn_error",
          error: contextError,
          rawOutput: "",
          stderr: "",
          model,
          backend,
          durationMs: Date.now() - startTime
        };
      }
    }
    if (request.attachUrl) {
      const urlError = validateAttachUrl(request.attachUrl);
      if (urlError) {
        return {
          success: false,
          errorCode: "spawn_error",
          error: urlError,
          rawOutput: "",
          stderr: "",
          model,
          backend,
          durationMs: Date.now() - startTime
        };
      }
    }
    const args = [
      "run",
      "--format",
      "json",
      "--model",
      String(request.model)
    ];
    if (request.contextFiles) {
      for (const filePath of request.contextFiles) {
        const canonical = fs2.realpathSync(filePath);
        args.push("--file", canonical);
      }
    }
    if (request.attachUrl) {
      args.push("--attach", request.attachUrl);
    }
    emitter.emit({
      type: "agent:invoke",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: "driver",
      data: { role: request.role, backend, model: String(model) }
    });
    return new Promise((resolve) => {
      let proc;
      try {
        proc = childProcess2.spawn("opencode", args, {
          cwd: request.projectDir,
          detached: true,
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: "driver",
          data: { role: request.role, reason: err.message }
        });
        resolve({
          success: false,
          errorCode: "spawn_error",
          error: err.message,
          rawOutput: "",
          stderr: "",
          model,
          backend,
          durationMs
        });
        return;
      }
      const promptContent = request.schema ? request.prompt + JSON_DIRECTIVE2 : request.prompt;
      proc.stdin.write(promptContent);
      proc.stdin.end();
      let stdoutBuf = "";
      let stderrBuf = "";
      let killStarted = false;
      let errorCode = "crash";
      let killTimer;
      let timeoutTimer;
      let resolved = false;
      const doResolve = (result) => {
        if (resolved) return;
        resolved = true;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        if (request.signal) {
          try {
            request.signal.removeEventListener("abort", onAbort);
          } catch {
          }
        }
        resolve(result);
      };
      const startKillSequence = (code) => {
        if (killStarted) return;
        killStarted = true;
        errorCode = code;
        if (proc.pid !== void 0) {
          try {
            proc.stdin.destroy();
          } catch {
          }
          safeKill2(proc.pid, "SIGTERM");
          killTimer = setTimeout(() => {
            if (proc.pid !== void 0) {
              safeKill2(proc.pid, "SIGKILL");
            }
          }, KILL_GRACE_MS2);
        }
      };
      const timeout = request.timeout ?? DEFAULT_TIMEOUT;
      timeoutTimer = setTimeout(() => {
        startKillSequence("timeout");
      }, timeout);
      const onAbort = () => {
        startKillSequence("aborted");
      };
      if (request.signal) {
        request.signal.addEventListener("abort", onAbort, { once: true });
      }
      proc.stdout.on("data", (chunk) => {
        stdoutBuf += chunk.toString();
      });
      proc.stderr.on("data", (chunk) => {
        stderrBuf += chunk.toString();
      });
      proc.on("error", (err) => {
        const durationMs = Date.now() - startTime;
        emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: "driver",
          data: { role: request.role, reason: err.message }
        });
        doResolve({
          success: false,
          errorCode: "spawn_error",
          error: err.message,
          rawOutput: truncate2(stdoutBuf, MAX_RAW_OUTPUT2),
          stderr: truncate2(stderrBuf, MAX_STDERR2),
          model,
          backend,
          durationMs
        });
      });
      proc.on("close", (exitCode) => {
        const durationMs = Date.now() - startTime;
        if (killStarted) {
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason: `Process ${errorCode}` }
          });
          doResolve({
            success: false,
            errorCode,
            error: `Process ${errorCode} after ${durationMs}ms`,
            rawOutput: truncate2(stdoutBuf, MAX_RAW_OUTPUT2),
            stderr: truncate2(stderrBuf, MAX_STDERR2),
            model,
            backend,
            durationMs
          });
          return;
        }
        if (exitCode !== 0 && exitCode !== null) {
          const stderrSnippet = stderrBuf.trim().slice(0, 500);
          const reason = stderrSnippet ? `Process exited with code ${exitCode}: ${stderrSnippet}` : `Process exited with code ${exitCode}`;
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason }
          });
          doResolve({
            success: false,
            errorCode: "crash",
            error: reason,
            rawOutput: truncate2(stdoutBuf, MAX_RAW_OUTPUT2),
            stderr: truncate2(stderrBuf, MAX_STDERR2),
            model,
            backend,
            durationMs
          });
          return;
        }
        if (stdoutBuf.trim() === "") {
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason: "Empty output from backend" }
          });
          doResolve({
            success: false,
            errorCode: "empty_output",
            error: "Backend produced empty output",
            rawOutput: "",
            stderr: truncate2(stderrBuf, MAX_STDERR2),
            model,
            backend,
            durationMs
          });
          return;
        }
        const parsed = parseStructuredOutput(stdoutBuf);
        if (parsed.ok) {
          emitter.emit({
            type: "agent:result",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, durationMs }
          });
          doResolve({
            success: true,
            output: parsed.output,
            rawOutput: truncate2(stdoutBuf, MAX_RAW_OUTPUT2),
            stderr: truncate2(stderrBuf, MAX_STDERR2),
            model,
            backend,
            durationMs
          });
        } else {
          emitter.emit({
            type: "agent:error",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId: "driver",
            data: { role: request.role, reason: "Failed to parse output" }
          });
          doResolve({
            success: false,
            errorCode: "invalid_json",
            error: "Failed to parse structured output from backend",
            rawOutput: truncate2(stdoutBuf, MAX_RAW_OUTPUT2),
            stderr: truncate2(stderrBuf, MAX_STDERR2),
            model,
            backend,
            durationMs
          });
        }
      });
    });
  }
  async function checkAvailability() {
    return new Promise((resolve) => {
      let resolved = false;
      let stdoutBuf = "";
      let timeoutTimer;
      const doResolve = (result) => {
        if (resolved) return;
        resolved = true;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        resolve(result);
      };
      const proc = childProcess2.spawn("opencode", ["--version"], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      timeoutTimer = setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {
        }
        doResolve({ available: false, error: "opencode --version timed out" });
      }, AVAILABILITY_TIMEOUT2);
      proc.stdout.on("data", (chunk) => {
        stdoutBuf += chunk.toString();
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          doResolve({ available: false, error: "opencode not found in PATH" });
        } else {
          doResolve({ available: false, error: err.message });
        }
      });
      proc.on("close", () => {
        const version = stdoutBuf.trim();
        if (version.length > 0) {
          doResolve({ available: true, version });
        } else {
          doResolve({ available: false, error: "opencode --version produced no output" });
        }
      });
    });
  }
  return { name, invoke, checkAvailability };
}

// src/drivers/driver-registry.ts
function createDriverRegistry(config, emitter) {
  const claudeDriver = createClaudeDriver(emitter);
  const openCodeDriver = createOpenCodeDriver(emitter);
  const drivers = {
    claude: claudeDriver,
    opencode: openCodeDriver
  };
  function getDriver(role, tag) {
    const assignment = getModelAssignment(config, role, tag);
    const driver = drivers[assignment.backend];
    const model = assignment.model;
    return { driver, model, agent: assignment.agent };
  }
  async function checkAll() {
    const [claudeAvail, opencodeAvail] = await Promise.all([
      claudeDriver.checkAvailability(),
      openCodeDriver.checkAvailability()
    ]);
    return {
      claude: claudeAvail,
      opencode: opencodeAvail
    };
  }
  return { getDriver, checkAll };
}
export {
  createDriverRegistry
};
