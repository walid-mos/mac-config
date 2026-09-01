import { readBoundedResponse } from './bounded-response.ts'

import type { HttpFetch } from './tweet-context.ts'

const IMAGE_TIMEOUT_MS = 15_000
const MAX_IMAGE_BYTES = 8_388_608
const MAX_REDIRECTS = 3
const MEDIA_HOST_SUFFIXES = [
	'.fixupx.com',
	'.fxtwitter.com',
	'.twimg.com',
	'.vxtwitter.com',
]
const MEDIA_HOSTS = new Set([
	'abs.twimg.com',
	'pbs.twimg.com',
	'ton.twimg.com',
	'video.twimg.com',
])
const REDIRECT_STATUS = {
	FOUND: 302,
	MOVED_PERMANENTLY: 301,
	PERMANENT_REDIRECT: 308,
	SEE_OTHER: 303,
	TEMPORARY_REDIRECT: 307,
} as const
const REDIRECT_STATUSES = new Set<number>(Object.values(REDIRECT_STATUS))
const SUPPORTED_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])

type MediaBytesSuccess = {
	bytes: Uint8Array
	isSuccess: true
	mimeType: string
}

export type MediaFailure = {
	error: string
	isSuccess: false
}

export type MediaBytesResult = MediaBytesSuccess | MediaFailure

export function isAllowedMediaUrl(candidate: URL): boolean {
	const hostname = candidate.hostname.toLowerCase()
	const hasAllowedHost =
		MEDIA_HOSTS.has(hostname) ||
		MEDIA_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
	return (
		candidate.protocol === 'https:' &&
		!candidate.username &&
		!candidate.password &&
		hasAllowedHost
	)
}

function parsedAllowedMediaUrl(rawUrl: string): URL | MediaFailure {
	try {
		const parsedUrl = new URL(rawUrl)
		if (!isAllowedMediaUrl(parsedUrl)) {
			return {
				error: `blocked host ${parsedUrl.hostname}`,
				isSuccess: false,
			}
		}
		return parsedUrl
	} catch {
		return { error: 'invalid URL', isSuccess: false }
	}
}

function redirectedUrl(
	response: Response,
	currentUrl: URL,
): URL | MediaFailure | undefined {
	if (!REDIRECT_STATUSES.has(response.status)) return undefined
	const location = response.headers.get('location')
	if (!location)
		return { error: 'redirect without location', isSuccess: false }
	try {
		const nextUrl = new URL(location, currentUrl)
		if (!isAllowedMediaUrl(nextUrl)) {
			return {
				error: `blocked redirect host ${nextUrl.hostname}`,
				isSuccess: false,
			}
		}
		return nextUrl
	} catch {
		return { error: 'invalid redirect URL', isSuccess: false }
	}
}

type MediaRequest = {
	fetcher: HttpFetch
	redirectCount: number
	signal: AbortSignal
	url: URL
}

async function fetchAllowedResponse(
	request: MediaRequest,
): Promise<Response | MediaFailure> {
	if (request.redirectCount > MAX_REDIRECTS) {
		return { error: 'too many redirects', isSuccess: false }
	}
	const response = await request.fetcher(request.url, {
		headers: {
			Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
			'User-Agent': 'Mozilla/5.0 (compatible; pi-twitter-fetch/1.0)',
		},
		redirect: 'manual',
		signal: request.signal,
	})
	const nextUrl = redirectedUrl(response, request.url)
	if (!nextUrl) return response
	if ('isSuccess' in nextUrl) return nextUrl
	return fetchAllowedResponse({
		...request,
		redirectCount: request.redirectCount + 1,
		url: nextUrl,
	})
}

export async function fetchAllowedMediaBytes(
	rawUrl: string,
	signal: AbortSignal | undefined,
	fetcher: HttpFetch = fetch,
): Promise<MediaBytesResult> {
	try {
		const timeout = AbortSignal.timeout(IMAGE_TIMEOUT_MS)
		const requestSignal = signal
			? AbortSignal.any([signal, timeout])
			: timeout
		const initialUrl = parsedAllowedMediaUrl(rawUrl)
		if ('isSuccess' in initialUrl) return initialUrl
		const response = await fetchAllowedResponse({
			fetcher,
			redirectCount: 0,
			signal: requestSignal,
			url: initialUrl,
		})
		if ('isSuccess' in response) return response
		if (!response.ok) {
			return { error: `HTTP ${response.status}`, isSuccess: false }
		}
		const [mimeType = ''] = (response.headers.get('content-type') ?? '')
			.split(';', 1)
			.map(headerPart => headerPart.trim().toLowerCase())
		if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
			return {
				error: `unsupported type ${mimeType || 'unknown'}`,
				isSuccess: false,
			}
		}
		const responseRead = await readBoundedResponse(
			response,
			MAX_IMAGE_BYTES,
		)
		if (!responseRead.isSuccess) return responseRead
		return { bytes: responseRead.bytes, isSuccess: true, mimeType }
	} catch (error) {
		const message = signal?.aborted ? 'cancelled' : 'request failed'
		return {
			error:
				error instanceof Error
					? `${message}: ${error.message}`
					: message,
			isSuccess: false,
		}
	}
}
