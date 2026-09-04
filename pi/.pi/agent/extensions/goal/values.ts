import { MAX_PROOF_ITEM_CHARS, MAX_PROOF_ITEMS } from './contracts.ts'
import { sanitizeResultText } from './sanitize.ts'

export function sanitizeEvaluatorText(value: string): string {
	return sanitizeResultText(value)
}

function truncateCodeUnits(value: string, max: number): string {
	if (value.length <= max) return value
	let end = Math.max(0, max - 1)
	const finalCodeUnit = value.charCodeAt(end - 1)
	if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) end -= 1
	return `${value.slice(0, end)}…`
}

export function normalizeBoundedText(value: string, max: number): string {
	return truncateCodeUnits(
		sanitizeEvaluatorText(value).replace(/\s+/gu, ' ').trim(),
		max,
	)
}

export function normalizeProofItems(proofs: readonly string[]): string[] {
	const unique: string[] = []
	for (const proof of proofs) {
		const normalized = normalizeBoundedText(proof, MAX_PROOF_ITEM_CHARS)
		if (!normalized) continue
		const previous = unique.indexOf(normalized)
		if (previous >= 0) unique.splice(previous, 1)
		unique.push(normalized)
	}
	return unique
}

export function normalizeProofs(proofs: readonly string[]): string[] {
	return normalizeProofItems(proofs).slice(-MAX_PROOF_ITEMS)
}

export function updateProofLedger(
	current: readonly string[],
	added: readonly string[],
	invalidated: readonly string[],
): string[] {
	const removed = new Set(normalizeProofItems(invalidated))
	return normalizeProofs([
		...current.filter(proof => !removed.has(proof)),
		...added,
	])
}

const OUTCOME_WORDS = new Set([
	'error',
	'fail',
	'failed',
	'failure',
	'pass',
	'passed',
	'success',
	'succeeded',
])

function proofTokens(proof: string): ReadonlySet<string> {
	return new Set(proof.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])
}

function hasDifferentOutcome(
	left: ReadonlySet<string>,
	right: ReadonlySet<string>,
): boolean {
	const leftOutcomes = [...left].filter(token => OUTCOME_WORDS.has(token))
	const rightOutcomes = [...right].filter(token => OUTCOME_WORDS.has(token))
	return (
		leftOutcomes.some(token => !right.has(token)) ||
		rightOutcomes.some(token => !left.has(token))
	)
}

function isSimilarProof(left: string, right: string): boolean {
	const leftTokens = proofTokens(left)
	const rightTokens = proofTokens(right)
	if (hasDifferentOutcome(leftTokens, rightTokens)) return false
	const smallest = Math.min(leftTokens.size, rightTokens.size)
	if (smallest === 0) return true
	const shared = [...leftTokens].filter(token =>
		rightTokens.has(token),
	).length
	return shared / smallest >= 0.8
}

/** True only for an invalidation or a materially new verified fact. */
export function hasProofLedgerProgress(
	current: readonly string[],
	added: readonly string[],
	invalidated: readonly string[],
): boolean {
	const normalizedCurrent = normalizeProofItems(current)
	const removed = new Set(normalizeProofItems(invalidated))
	if (normalizedCurrent.some(proof => removed.has(proof))) return true
	return normalizeProofItems(added).some(
		proof =>
			!normalizedCurrent.some(previous =>
				isSimilarProof(previous, proof),
			),
	)
}

export function formatProofLedger(proofs: readonly string[]): string {
	if (proofs.length === 0) return '(empty)'
	return proofs.map(proof => `- ${proof}`).join('\n')
}

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
