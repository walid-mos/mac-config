import {
  AGENT_ROLES
} from "./chunk-BP3VSFNG.js";
import {
  ModelAssignmentSchema
} from "./chunk-7OZYOMGU.js";

// src/config/config-resolver.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parse as parseToml } from "smol-toml";

// src/core/errors.ts
var ConfigValidationError = class extends Error {
  constructor(message, filePath, validationErrors) {
    super(message);
    this.filePath = filePath;
    this.validationErrors = validationErrors;
    this.name = "ConfigValidationError";
  }
};

// src/config/model-registry.ts
var MODEL_ALIASES = /* @__PURE__ */ new Map([
  ["opus", "claude-opus-4-6"],
  ["sonnet", "claude-sonnet-4-6"],
  ["haiku", "claude-haiku-4-5-20251001"],
  ["kimi", "moonshotai/kimi-k2.5"]
]);
function resolveModel(raw) {
  return MODEL_ALIASES.get(raw) ?? raw;
}

// src/config/config-resolver.ts
var TAG_RE = /^[a-zA-Z0-9_-]{1,32}$/;
var TAG_OVERRIDE_RE = /^(?:code|test|plan|review|security|consistency|merge|docs)-[a-zA-Z0-9_-]{1,32}$/;
var AGENT_ROLE_SET = new Set(AGENT_ROLES);
var DEFAULT_ASSIGNMENT = { backend: "claude", model: resolveModel("opus") };
function resolveSwarmConfig(projectDir, explicitPath) {
  if (explicitPath !== void 0) {
    if (!explicitPath.endsWith(".toml")) {
      throw new ConfigValidationError(
        `Config path must end in .toml: ${explicitPath}`,
        explicitPath,
        ["Config file must have .toml extension"]
      );
    }
    const canonicalPath = path.resolve(explicitPath);
    return parseAndBuildConfig(canonicalPath);
  }
  const candidates = [
    path.join(projectDir, "swarm.toml"),
    path.join(os.homedir(), ".config", "swarm", "default.toml")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return parseAndBuildConfig(candidate);
    }
  }
  return {
    config: buildDefaultConfig(),
    resolvedFrom: "builtin-defaults"
  };
}
function getModelAssignment(config, role, tag) {
  if (tag !== void 0) {
    if (!TAG_RE.test(tag)) {
      throw new Error(
        `Invalid tag "${tag}": must match /^[a-zA-Z0-9_-]{1,32}$/`
      );
    }
    const taggedKey = `${role}-${tag}`;
    const taggedAssignment = config.models.tagged[taggedKey];
    if (taggedAssignment) {
      return taggedAssignment;
    }
  }
  return config.models.agents[role];
}
function parseAndBuildConfig(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (content.trim() === "") {
    return {
      config: buildDefaultConfig(),
      resolvedFrom: filePath
    };
  }
  let parsed;
  try {
    parsed = parseToml(content);
  } catch (err) {
    throw new ConfigValidationError(
      `Failed to parse TOML: ${err.message}`,
      filePath,
      [err.message]
    );
  }
  const models = parsed["models"] ?? {};
  const agents = {};
  const tagged = {};
  for (const [key, value] of Object.entries(models)) {
    const result = ModelAssignmentSchema.safeParse(value);
    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid model assignment for "${key}": ${result.error.issues.map((i) => i.message).join(", ")}`,
        filePath,
        result.error.issues.map((i) => i.message)
      );
    }
    const parsed2 = result.data;
    const assignment = {
      backend: parsed2.backend,
      model: resolveModel(parsed2.model),
      ...parsed2.agent !== void 0 && { agent: parsed2.agent }
    };
    if (AGENT_ROLE_SET.has(key)) {
      agents[key] = assignment;
    } else if (TAG_OVERRIDE_RE.test(key)) {
      tagged[key] = assignment;
    } else {
      process.stderr.write(
        `Warning: unrecognized key "${key}" in [models] of ${filePath}
`
      );
    }
  }
  const filledAgents = fillDefaults(agents);
  return {
    config: { models: { agents: filledAgents, tagged } },
    resolvedFrom: filePath
  };
}
function buildDefaultConfig() {
  const agents = {};
  for (const role of AGENT_ROLES) {
    agents[role] = { ...DEFAULT_ASSIGNMENT };
  }
  return { models: { agents, tagged: {} } };
}
function fillDefaults(partial) {
  const result = {};
  for (const role of AGENT_ROLES) {
    result[role] = partial[role] ?? { ...DEFAULT_ASSIGNMENT };
  }
  return result;
}

export {
  resolveSwarmConfig,
  getModelAssignment
};
