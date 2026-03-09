// src/drivers/output-parser.ts
function extractStreamResult(ndjson) {
  const lines = ndjson.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "result" && event.result !== void 0) {
        const output = typeof event.result === "string" ? event.result : JSON.stringify(event.result);
        if (output.trim()) return { ok: true, output, strategy: "stream-json" };
      }
    } catch {
      continue;
    }
  }
  return { ok: false, raw: ndjson };
}
function parseStructuredOutput(raw) {
  if (raw.trim() === "") {
    return { ok: false, raw };
  }
  const eventArrayResult = tryEventArray(raw);
  if (eventArrayResult) return eventArrayResult;
  const resultFieldResult = tryResultField(raw);
  if (resultFieldResult) return resultFieldResult;
  const directResult = tryDirect(raw);
  if (directResult) return directResult;
  const fenceResult = tryFenceStrip(raw);
  if (fenceResult) return fenceResult;
  const braceResult = tryBraceExtract(raw);
  if (braceResult) return braceResult;
  const bracketResult = tryBracketExtract(raw);
  if (bracketResult) return bracketResult;
  return { ok: false, raw };
}
function tryEventArray(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  let resultElement = null;
  for (const element of parsed) {
    if (typeof element === "object" && element !== null && "type" in element && element["type"] === "result" && "result" in element) {
      resultElement = element;
    }
  }
  if (!resultElement) return null;
  const output = typeof resultElement.result === "string" ? resultElement.result : JSON.stringify(resultElement.result);
  if (output.trim() === "") return null;
  return { ok: true, output, strategy: "event-array" };
}
function tryResultField(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  if (!("result" in parsed)) return null;
  const result = parsed["result"];
  const output = typeof result === "string" ? result : JSON.stringify(result);
  if (output.trim() === "") return null;
  return { ok: true, output, strategy: "result-field" };
}
function tryDirect(raw) {
  try {
    JSON.parse(raw);
    return { ok: true, output: raw, strategy: "direct" };
  } catch {
    return null;
  }
}
var FENCE_OPEN = /`{3,}(?:json)?\s*(?:\r?\n|$)/;
var FENCE_CLOSE_LAZY = /\r?\n\s*`{3,}\s*(?:\r?\n|$)/;
function tryFenceStrip(raw) {
  const openMatch = FENCE_OPEN.exec(raw);
  if (!openMatch) return null;
  const contentStart = openMatch.index + openMatch[0].length;
  const afterOpen = raw.slice(contentStart);
  const lazyClose = FENCE_CLOSE_LAZY.exec(afterOpen);
  if (lazyClose) {
    const content = afterOpen.slice(0, lazyClose.index).trim();
    try {
      JSON.parse(content);
      return { ok: true, output: content, strategy: "fence-strip" };
    } catch {
    }
  }
  const remaining = raw.slice(contentStart);
  let lastFenceIdx = -1;
  const closeFenceGlobal = /\r?\n\s*`{3,}\s*(?:\r?\n|$)/g;
  let match;
  while ((match = closeFenceGlobal.exec(remaining)) !== null) {
    lastFenceIdx = match.index;
  }
  if (lastFenceIdx > 0) {
    const content = remaining.slice(0, lastFenceIdx).trim();
    try {
      JSON.parse(content);
      return { ok: true, output: content, strategy: "fence-strip" };
    } catch {
    }
  }
  return null;
}
function tryBraceExtract(raw) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    JSON.parse(candidate);
    return { ok: true, output: candidate, strategy: "brace-extract" };
  } catch {
    return null;
  }
}
function tryBracketExtract(raw) {
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) return null;
  const candidate = raw.slice(firstBracket, lastBracket + 1);
  try {
    JSON.parse(candidate);
    return { ok: true, output: candidate, strategy: "bracket-extract" };
  } catch {
    return null;
  }
}

export {
  extractStreamResult,
  parseStructuredOutput
};
