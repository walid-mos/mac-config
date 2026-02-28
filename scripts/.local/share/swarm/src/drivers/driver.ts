import type { AgentRole, ModelId } from '../types.js'

// === Backend ===

export type BackendName = 'claude' | 'opencode'

// === Token Usage ===

export interface TokenUsage {
  input: number
  output: number
}

// === Agent Request ===

export interface AgentRequest {
  prompt: string
  role: AgentRole
  agent?: string
  schema?: string
  model: ModelId
  projectDir: string
  timeout?: number
  contextFiles?: string[]
  attachUrl?: string
  signal?: AbortSignal
}

// === Agent Result ===

export type AgentResult =
  | {
      success: true
      output: string
      rawOutput: string
      stderr: string
      model: ModelId
      backend: BackendName
      durationMs: number
      tokenUsage?: TokenUsage
    }
  | {
      success: false
      errorCode: 'timeout' | 'aborted' | 'crash' | 'empty_output' | 'invalid_json' | 'spawn_error'
      error: string
      rawOutput: string
      stderr: string
      model: ModelId
      backend: BackendName
      durationMs: number
    }

// === Driver Availability ===

export type DriverAvailability =
  | { available: true; version: string }
  | { available: false; error: string }

// === Driver Interface ===

export interface Driver {
  name: BackendName
  invoke(request: AgentRequest): Promise<AgentResult>
  checkAvailability(): Promise<DriverAvailability>
}

// === Driver Resolution ===

export interface DriverResolution {
  driver: Driver
  model: ModelId
}

// === Driver Registry ===

export interface DriverRegistry {
  getDriver(role: AgentRole, tag?: string): DriverResolution
  checkAll(): Promise<Record<BackendName, DriverAvailability>>
}
