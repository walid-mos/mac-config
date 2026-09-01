import { runCollecting } from './process.ts'

import type { NotificationOperations } from './process.ts'

const HERDR = '/opt/homebrew/bin/herdr'

/**
 * Sonde best-effort de l'état de focalisation Herdr : `true` (pane focalisée,
 * l'utilisateur la regarde déjà), `false` (pane en arrière-plan) ou
 * `undefined` (sonde indisponible — échec, sortie illisible, timeout).
 * `undefined` laisse passer la notification : rater une fin de tâche est pire
 * qu'un doublon rare.
 */
export function createFocusProbe(
	operations: NotificationOperations,
	timeoutMs = 1_500,
): (socket: string, pane: string) => Promise<boolean | undefined> {
	return async function probe(
		socket: string,
		pane: string,
	): Promise<boolean | undefined> {
		const stdout = await runCollecting(
			operations,
			HERDR,
			['agent', 'get', pane],
			{
				env: { ...process.env, HERDR_SOCKET_PATH: socket },
				timeout: timeoutMs,
			},
			timeoutMs,
		)
		try {
			const parsed = JSON.parse(stdout ?? '') as {
				result?: { agent?: { focused?: unknown } }
			}
			const focused = parsed.result?.agent?.focused
			return typeof focused === 'boolean' ? focused : undefined
		} catch {
			return undefined
		}
	}
}
