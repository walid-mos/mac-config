import { MAX_PROOF_ITEM_CHARS, MAX_PROOF_ITEMS } from './contracts.ts'
import { sanitizeResultText } from './sanitize.ts'

function truncateCodeUnits(value: string, max: number): string {
	if (value.length <= max) return value
	let end = Math.max(0, max - 1)
	const finalCodeUnit = value.charCodeAt(end - 1)
	if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) end -= 1
	return `${value.slice(0, end)}…`
}

export function normalizeBoundedText(value: string, max: number): string {
	return truncateCodeUnits(
		sanitizeResultText(value).replace(/\s+/gu, ' ').trim(),
		max,
	)
}

export function normalizeProofs(proofs: readonly string[]): string[] {
	const unique: string[] = []
	for (const proof of proofs) {
		const normalized = normalizeBoundedText(proof, MAX_PROOF_ITEM_CHARS)
		if (!normalized) continue
		const previous = unique.indexOf(normalized)
		if (previous >= 0) unique.splice(previous, 1)
		unique.push(normalized)
	}
	return unique.slice(-MAX_PROOF_ITEMS)
}

export function updateProofLedger(
	current: readonly string[],
	added: readonly string[],
	invalidated: readonly string[],
): string[] {
	const removed = new Set(normalizeProofs(invalidated))
	return normalizeProofs([
		...current.filter(proof => !removed.has(proof)),
		...added,
	])
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
