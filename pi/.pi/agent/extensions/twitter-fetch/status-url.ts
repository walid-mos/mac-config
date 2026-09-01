const STATUS_HOSTS = new Set([
	'fxtwitter.com',
	'twitter.com',
	'vxtwitter.com',
	'x.com',
])
const STATUS_PATH_PATTERN =
	/^\/(?:i\/(?:web\/)?status|[^/?#]+\/status)\/(\d+)(?:[/?#]|$)/i
const STATUS_IN_TEXT_PATTERN = new RegExp(
	String.raw`(?<![A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com)\/(?:(?:i\/web|i)\/status|[^/?#\s]+\/status)\/(\d+)`,
	'gi',
)

const FXTWITTER_API_HOST = 'api.fxtwitter.com'

function normalizedStatusUrl(rawUrl: string): URL | undefined {
	try {
		const candidate = rawUrl.match(/^https?:\/\//i)
			? rawUrl
			: `https://${rawUrl}`
		return new URL(candidate)
	} catch {
		return undefined
	}
}

export function statusApiUrl(statusId: string): string {
	return `https://${FXTWITTER_API_HOST}/2/status/${statusId}`
}

export function statusIdFromUrl(rawUrl: unknown): string | undefined {
	if (typeof rawUrl !== 'string') return undefined
	const parsedUrl = normalizedStatusUrl(rawUrl)
	if (!parsedUrl || parsedUrl.username || parsedUrl.password) return undefined
	const hostname = parsedUrl.hostname
		.toLowerCase()
		.replace(/^(?:www|mobile)\./, '')
	if (!STATUS_HOSTS.has(hostname)) return undefined
	const pathMatch = parsedUrl.pathname.match(STATUS_PATH_PATTERN)
	if (!pathMatch) return undefined
	const [, statusId] = pathMatch
	return statusId
}

export function rewriteTwitterStatusUrl(rawUrl: unknown): string | undefined {
	const statusId = statusIdFromUrl(rawUrl)
	if (!statusId) return undefined
	return statusApiUrl(statusId)
}

export function statusIdsInText(text: string, maximumIds: number): string[] {
	const statusIds = new Set<string>()
	for (const [, statusId] of text.matchAll(STATUS_IN_TEXT_PATTERN)) {
		if (statusId) statusIds.add(statusId)
	}
	return [...statusIds].slice(0, maximumIds)
}

export function isFxTwitterStatusApiUrl(rawUrl: unknown): boolean {
	if (typeof rawUrl !== 'string') return false
	try {
		const parsedUrl = new URL(rawUrl)
		return (
			parsedUrl.protocol === 'https:' &&
			parsedUrl.hostname === FXTWITTER_API_HOST &&
			/^\/2\/status\/\d+\/?$/.test(parsedUrl.pathname)
		)
	} catch {
		return false
	}
}
