import { fxTwitterObject } from './fx-twitter-data.ts'
import {
	isFxTwitterStatusApiUrl,
	rewriteTwitterStatusUrl,
} from './status-url.ts'

type FetchContentInputPatch = {
	shouldClearAuth: boolean
	url?: string
	urls?: unknown[]
}

function stringEntries(candidate: unknown): string[] {
	if (!Array.isArray(candidate)) return []
	const entries: unknown[] = candidate
	return entries.filter((entry): entry is string => typeof entry === 'string')
}

export function fetchContentUrls(input: unknown, details: unknown): string[] {
	const fetchInput = fxTwitterObject(input)
	const fetchDetails = fxTwitterObject(details)
	const directUrl =
		typeof fetchInput?.url === 'string' ? [fetchInput.url] : []
	return [
		...directUrl,
		...stringEntries(fetchInput?.urls),
		...stringEntries(fetchDetails?.urls),
	]
}

export function fetchContentInputPatch(input: unknown): FetchContentInputPatch {
	const fetchInput = fxTwitterObject(input)
	if (!fetchInput) return { shouldClearAuth: false }
	const rewrittenUrl = rewriteTwitterStatusUrl(fetchInput.url)
	const originalUrls = Array.isArray(fetchInput.urls)
		? fetchInput.urls
		: undefined
	const rewrittenUrls = originalUrls?.map(
		entry => rewriteTwitterStatusUrl(entry) ?? entry,
	)
	const hasRewrittenList = Boolean(
		originalUrls?.some((entry, index) => entry !== rewrittenUrls?.[index]),
	)
	const patch: FetchContentInputPatch = {
		shouldClearAuth: Boolean(rewrittenUrl) || hasRewrittenList,
	}
	if (rewrittenUrl) patch.url = rewrittenUrl
	if (hasRewrittenList && rewrittenUrls) patch.urls = rewrittenUrls
	return patch
}

export function containsFxTwitterApiUrl(
	input: unknown,
	details: unknown,
): boolean {
	return fetchContentUrls(input, details).some(isFxTwitterStatusApiUrl)
}
