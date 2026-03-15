import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { parse as parseToml } from 'smol-toml'
import type { SwarmConfig, AgentRole, ModelAssignment, ResolvedConfig } from '../core/types.js'
import { AGENT_ROLES } from '../core/types.js'
import { ConfigValidationError } from '../core/errors.js'
import { ModelAssignmentSchema } from '../core/validation.js'
import { resolveModel } from './model-registry.js'

export interface ResolvedConfigSnapshot {
  projectDir: string
  resolvedFrom: string
  config: SwarmConfig
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAG_RE = /^[a-zA-Z0-9_-]{1,32}$/
const TAG_OVERRIDE_RE = /^(?:code|test|plan|review|security|consistency|merge|docs)-[a-zA-Z0-9_-]{1,32}$/
const AGENT_ROLE_SET = new Set<string>(AGENT_ROLES)

const DEFAULT_ASSIGNMENT: ModelAssignment = { backend: 'claude', model: resolveModel('opus') }

// ---------------------------------------------------------------------------
// resolveSwarmConfig
// ---------------------------------------------------------------------------

export function resolveSwarmConfig(projectDir: string, explicitPath?: string): ResolvedConfig {
  // SC-8: explicit config path must end in .toml
  if (explicitPath !== undefined) {
    if (!explicitPath.endsWith('.toml')) {
      throw new ConfigValidationError(
        `Config path must end in .toml: ${explicitPath}`,
        explicitPath,
        ['Config file must have .toml extension']
      )
    }
    const canonicalPath = path.resolve(explicitPath)
    return parseAndBuildConfig(canonicalPath)
  }

  // Precedence chain: project → user global → built-in defaults
  const candidates = [
    path.join(projectDir, 'swarm.toml'),
    path.join(os.homedir(), '.config', 'swarm', 'default.toml'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return parseAndBuildConfig(candidate)
    }
  }

  // No config found — use built-in defaults
  return {
    config: buildDefaultConfig(),
    resolvedFrom: 'builtin-defaults',
  }
}

// ---------------------------------------------------------------------------
// getModelAssignment
// ---------------------------------------------------------------------------

export function getModelAssignment(config: SwarmConfig, role: AgentRole, tag?: string): ModelAssignment {
  if (tag !== undefined) {
    if (!TAG_RE.test(tag)) {
      throw new Error(
        `Invalid tag "${tag}": must match /^[a-zA-Z0-9_-]{1,32}$/`
      )
    }
    const taggedKey = `${role}-${tag}`
    const taggedAssignment = config.models.tagged[taggedKey]
    if (taggedAssignment) {
      return taggedAssignment
    }
  }

  return config.models.agents[role]
}

export function createResolvedConfigSnapshot(
  projectDir: string,
  resolvedConfig: ResolvedConfig
): ResolvedConfigSnapshot {
  return {
    projectDir: path.resolve(projectDir),
    resolvedFrom: resolvedConfig.resolvedFrom,
    config: resolvedConfig.config,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseAndBuildConfig(filePath: string): ResolvedConfig {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Empty file is valid — all defaults apply
  if (content.trim() === '') {
    return {
      config: buildDefaultConfig(),
      resolvedFrom: filePath,
    }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseToml(content) as Record<string, unknown>
  } catch (err) {
    throw new ConfigValidationError(
      `Failed to parse TOML: ${(err as Error).message}`,
      filePath,
      [(err as Error).message]
    )
  }

  const models = (parsed['models'] ?? {}) as Record<string, unknown>
  const agents: Partial<Record<AgentRole, ModelAssignment>> = {}
  const tagged: Record<string, ModelAssignment> = {}

  for (const [key, value] of Object.entries(models)) {
    // Validate the value as a ModelAssignment
    const result = ModelAssignmentSchema.safeParse(value)
    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid model assignment for "${key}": ${result.error.issues.map(i => i.message).join(', ')}`,
        filePath,
        result.error.issues.map(i => i.message)
      )
    }

    const parsed = result.data as ModelAssignment
    const assignment: ModelAssignment = {
      backend: parsed.backend,
      model: resolveModel(parsed.model),
      ...(parsed.agent !== undefined && { agent: parsed.agent }),
    }

    if (AGENT_ROLE_SET.has(key)) {
      agents[key as AgentRole] = assignment
    } else if (TAG_OVERRIDE_RE.test(key)) {
      tagged[key] = assignment
    } else {
      // Unrecognized key — warn to stderr
      process.stderr.write(
        `Warning: unrecognized key "${key}" in [models] of ${filePath}\n`
      )
    }
  }

  // Fill missing base roles with defaults
  const filledAgents = fillDefaults(agents)

  return {
    config: { models: { agents: filledAgents, tagged } },
    resolvedFrom: filePath,
  }
}

function buildDefaultConfig(): SwarmConfig {
  const agents = {} as Record<AgentRole, ModelAssignment>
  for (const role of AGENT_ROLES) {
    agents[role] = { ...DEFAULT_ASSIGNMENT }
  }
  return { models: { agents, tagged: {} } }
}

function fillDefaults(
  partial: Partial<Record<AgentRole, ModelAssignment>>
): Record<AgentRole, ModelAssignment> {
  const result = {} as Record<AgentRole, ModelAssignment>
  for (const role of AGENT_ROLES) {
    result[role] = partial[role] ?? { ...DEFAULT_ASSIGNMENT }
  }
  return result
}
