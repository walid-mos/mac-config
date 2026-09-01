import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { isRecord } from '../value.ts'

const AUTH_PATH = `${homedir()}/.pi/agent/auth.json`
const REQUEST_TIMEOUT_MS = 8_000

export function readAuthField(
	provider: string,
	field: string,
): string | undefined {
	const value = readAuthRecord(provider)?.[field]
	return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function readToken(provider: string): string | undefined {
	return readAuthField(provider, 'access')
}

export async function fetchJson(
	url: string,
	token: string,
): Promise<unknown | undefined> {
	return fetchJsonWithHeaders(url, { Authorization: `Bearer ${token}` })
}

export async function fetchJsonWithHeaders(
	url: string,
	headers: Record<string, string>,
): Promise<unknown | undefined> {
	try {
		const response = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})
		return response.ok ? await response.json() : undefined
	} catch {
		return undefined
	}
}

function readAuthRecord(provider: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(readFileSync(AUTH_PATH, 'utf8'))
		if (!isRecord(parsed)) return undefined
		const entry = parsed[provider]
		return isRecord(entry) ? entry : undefined
	} catch {
		return undefined
	}
}
