export function finiteNumber(value: unknown): number | undefined {
	const number =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number(value)
				: NaN
	return Number.isFinite(number) ? number : undefined
}

export function valOf(value: unknown): number | undefined {
	if (typeof value === 'number') return finiteNumber(value)
	if (isRecord(value) && 'val' in value) return finiteNumber(value.val)
	return finiteNumber(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readSafely<T>(read: () => T, fallback: T): T {
	try {
		return read()
	} catch {
		return fallback
	}
}
