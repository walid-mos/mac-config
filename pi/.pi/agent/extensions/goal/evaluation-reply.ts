import {
	MAX_EVALUATOR_DIAGNOSTIC_CHARS,
	MAX_EVALUATOR_REASON_CHARS,
} from './contracts.ts'
import { assistantText } from './transcript.ts'
import {
	isRecord,
	isStringArray,
	normalizeBoundedText,
	normalizeProofItems,
	normalizeProofs,
} from './values.ts'

import type { ParsedEvaluatorReply } from './contracts.ts'
import type { AssistantMessage } from '@earendil-works/pi-ai'

export function parseEvaluatorReply(
	reply: AssistantMessage,
): ParsedEvaluatorReply {
	const contentTypes =
		[...new Set(reply.content.map(part => part.type))].join(',') || 'none'
	const stopReason = reply.stopReason ?? 'unknown'
	if (stopReason !== 'stop') {
		return {
			ok: false,
			reason: normalizeBoundedText(
				`Evaluator did not complete. content=${contentTypes}, stop=${stopReason}`,
				MAX_EVALUATOR_DIAGNOSTIC_CHARS,
			),
		}
	}
	const parsed = parseEvaluatorText(assistantText(reply))
	if (parsed.ok) return parsed
	return {
		ok: false,
		reason: normalizeBoundedText(
			`${parsed.reason} content=${contentTypes}, stop=${stopReason}`,
			MAX_EVALUATOR_DIAGNOSTIC_CHARS,
		),
	}
}

export function parseEvaluatorText(text: string): ParsedEvaluatorReply {
	const jsonText = text.trim()
	if (!jsonText.startsWith('{') || !jsonText.endsWith('}')) {
		return { ok: false, reason: 'Evaluator returned no JSON.' }
	}
	let value: unknown
	try {
		value = JSON.parse(jsonText)
	} catch {
		return { ok: false, reason: 'Evaluator JSON parse failed.' }
	}
	return parseEvaluatorPayload(value)
}

function parseEvaluatorPayload(value: unknown): ParsedEvaluatorReply {
	if (!isRecord(value)) {
		return { ok: false, reason: 'Evaluator JSON is not an object.' }
	}
	if (!isEvaluatorVerdict(value.verdict)) {
		const reason = normalizedReason(value.reason)
		return { ok: false, reason: reason || 'Unknown evaluator verdict.' }
	}
	if (
		!isStringArray(value.proofs) ||
		!isStringArray(value.invalidatedProofs)
	) {
		return {
			ok: false,
			reason: 'Evaluator proof updates are missing or invalid.',
		}
	}
	const reason = normalizedReason(value.reason)
	return {
		ok: true,
		verdict: value.verdict,
		reason: reason || value.verdict,
		proofs: normalizeProofs(value.proofs),
		invalidatedProofs: normalizeProofItems(value.invalidatedProofs),
	}
}

function normalizedReason(value: unknown): string {
	return typeof value === 'string'
		? normalizeBoundedText(value, MAX_EVALUATOR_REASON_CHARS)
		: ''
}

function isEvaluatorVerdict(
	value: unknown,
): value is 'met' | 'not_yet' | 'impossible' {
	return value === 'met' || value === 'not_yet' || value === 'impossible'
}
