// === Git Operations (Spec 4 — FR-9, FR-11, FR-12) ===

import type { SessionId } from './types.js'

// === API ===

export async function createFeatureBranch(
  _sessionId: SessionId,
  _projectDir: string
): Promise<string> {
  throw new Error('Not implemented')
}

export async function openDraftPr(
  _branch: string,
  _sessionId: SessionId,
  _projectDir: string
): Promise<{ prNumber: number; prUrl: string }> {
  throw new Error('Not implemented')
}

export async function commitSpecItem(
  _projectDir: string,
  _changedFiles: string[],
  _message: string
): Promise<string> {
  throw new Error('Not implemented')
}

export async function markPrReady(
  _prNumber: number,
  _projectDir: string
): Promise<void> {
  throw new Error('Not implemented')
}
