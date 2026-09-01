import assert from 'node:assert/strict'
import test from 'node:test'

import { readBoundedResponse } from '../extensions/twitter-fetch/bounded-response.ts'
import {
	fetchContentInputPatch,
	fetchContentUrls,
} from '../extensions/twitter-fetch/fetch-content-input.ts'
import {
	collectTweetMedia,
	parseFxTwitterPayload,
} from '../extensions/twitter-fetch/fx-twitter-data.ts'
import {
	fetchAllowedMediaBytes,
	isAllowedMediaUrl,
} from '../extensions/twitter-fetch/media-download.ts'
import { hydrateTweetMedia } from '../extensions/twitter-fetch/media-hydration.ts'
import {
	isFxTwitterStatusApiUrl,
	rewriteTwitterStatusUrl,
	statusIdFromUrl,
	statusIdsInText,
} from '../extensions/twitter-fetch/status-url.ts'
import {
	AUTOFETCH_CONTEXT_MARKER,
	autoFetchedContext,
} from '../extensions/twitter-fetch/tweet-context.ts'

import type { ImageFetcher } from '../extensions/twitter-fetch/media-hydration.ts'
import type { HttpFetch } from '../extensions/twitter-fetch/tweet-context.ts'

const TWEET_ID = '2094785889578746015'
const TWEET_URL = `https://x.com/zcode_ai/status/${TWEET_ID}?s=20`
const API_URL = `https://api.fxtwitter.com/2/status/${TWEET_ID}`

function tweetResponse(text = 'tweet body'): Response {
	return Response.json({
		status: {
			author: { screen_name: 'zcode_ai' },
			created_at: 'today',
			media: { photos: [{ url: 'https://pbs.twimg.com/ignored.jpg' }] },
			text,
		},
	})
}

const unavailableFetch: HttpFetch = async () =>
	new Response('unavailable', { status: 503 })

const failingFetch: HttpFetch = async () => {
	throw new Error('socket closed')
}

const validImageFetch: HttpFetch = async () =>
	new Response(new Uint8Array([1, 2, 3]), {
		headers: { 'content-type': 'image/png; charset=binary' },
	})

const partialImageFetcher: ImageFetcher = async url => {
	if (url.endsWith('/a.jpg')) {
		return {
			data: 'image-data',
			height: 480,
			isSuccess: true,
			mimeType: 'image/jpeg',
			width: 640,
		}
	}
	return { error: 'network failure', isSuccess: false }
}

test('status URLs are parsed only from supported exact hosts', () => {
	assert.equal(statusIdFromUrl(TWEET_URL), TWEET_ID)
	assert.equal(statusIdFromUrl(`x.com/i/status/${TWEET_ID}`), TWEET_ID)
	assert.equal(
		statusIdFromUrl(`https://notx.com/user/status/${TWEET_ID}`),
		undefined,
	)
	assert.equal(
		statusIdFromUrl(`https://x.com.evil.test/user/status/${TWEET_ID}`),
		undefined,
	)
	assert.equal(
		statusIdFromUrl(`https://user@x.com/user/status/${TWEET_ID}`),
		undefined,
	)
})

test('status extraction deduplicates IDs and rejects lookalike hosts', () => {
	const prompt = `${TWEET_URL} https://twitter.com/i/web/status/${TWEET_ID} https://notx.com/u/status/42`
	assert.deepEqual(statusIdsInText(prompt, 4), [TWEET_ID])
})

test('fetch_content rewrites supported status URLs to the FxTwitter API', () => {
	assert.equal(rewriteTwitterStatusUrl(TWEET_URL), API_URL)
	assert.equal(isFxTwitterStatusApiUrl(API_URL), true)
	assert.equal(
		isFxTwitterStatusApiUrl('https://api.fxtwitter.com/2/status/nope'),
		false,
	)
	assert.deepEqual(fetchContentInputPatch({ auth: true, url: TWEET_URL }), {
		shouldClearAuth: true,
		url: API_URL,
	})
})

test('fetch_content leaves unrelated URLs and auth untouched', () => {
	assert.deepEqual(
		fetchContentInputPatch({
			auth: true,
			url: 'https://notx.com/u/status/42',
		}),
		{ shouldClearAuth: false },
	)
})

test('fetch_content URL discovery reads inputs and tool details', () => {
	assert.deepEqual(
		fetchContentUrls(
			{ url: API_URL, urls: ['https://example.com', 42] },
			{ urls: ['https://details.example'] },
		),
		[API_URL, 'https://example.com', 'https://details.example'],
	)
})

test('automatic context is injected only after a successful bounded fetch', async () => {
	const fetcher: HttpFetch = async () => tweetResponse()
	const context = await autoFetchedContext(TWEET_URL, fetcher)
	assert.ok(context?.includes(AUTOFETCH_CONTEXT_MARKER))
	assert.ok(context?.includes(`"statusId":"${TWEET_ID}"`))
	assert.ok(context?.includes('tweet body'))
	assert.equal(context?.includes('ignored.jpg'), false)
})

test('automatic context remains absent when FxTwitter fails', async () => {
	assert.equal(
		await autoFetchedContext(TWEET_URL, unavailableFetch),
		undefined,
	)
})

test('automatic context truncates unexpectedly large tweet text', async () => {
	const fetcher: HttpFetch = async () => tweetResponse('x'.repeat(13_000))
	const context = await autoFetchedContext(TWEET_URL, fetcher)
	assert.ok(context?.includes('"wasTextTruncated":true'))
	assert.ok(context && context.length < 13_000)
})

test('bounded response reader rejects declared and streamed overflow', async () => {
	const declared = new Response('small', {
		headers: { 'content-length': '99' },
	})
	assert.deepEqual(await readBoundedResponse(declared, 5), {
		error: 'response too large',
		isSuccess: false,
	})
	const streamed = new Response('123456')
	assert.deepEqual(await readBoundedResponse(streamed, 5), {
		error: 'response too large',
		isSuccess: false,
	})
})

test('media host policy rejects credentials, HTTP, and unrelated hosts', () => {
	assert.equal(
		isAllowedMediaUrl(new URL('https://pbs.twimg.com/media/a.jpg')),
		true,
	)
	assert.equal(
		isAllowedMediaUrl(new URL('http://pbs.twimg.com/media/a.jpg')),
		false,
	)
	assert.equal(
		isAllowedMediaUrl(new URL('https://user@pbs.twimg.com/media/a.jpg')),
		false,
	)
	assert.equal(
		isAllowedMediaUrl(new URL('https://twimg.com.evil.test/a.jpg')),
		false,
	)
})

test('media redirects are revalidated before the next request', async () => {
	let requestCount = 0
	const fetcher: HttpFetch = async () => {
		requestCount += 1
		return new Response(undefined, {
			headers: { location: 'http://127.0.0.1/private' },
			status: 302,
		})
	}
	assert.deepEqual(
		await fetchAllowedMediaBytes(
			'https://pbs.twimg.com/media/a.jpg',
			undefined,
			fetcher,
		),
		{ error: 'blocked redirect host 127.0.0.1', isSuccess: false },
	)
	assert.equal(requestCount, 1)
})

test('media downloads tolerate network failures without rejecting', async () => {
	const media = await fetchAllowedMediaBytes(
		'https://pbs.twimg.com/media/a.jpg',
		undefined,
		failingFetch,
	)
	assert.equal(media.isSuccess, false)
	if (!media.isSuccess) assert.match(media.error, /request failed/)
})

test('media downloads accept a validated image response', async () => {
	const media = await fetchAllowedMediaBytes(
		'https://pbs.twimg.com/media/a.png',
		undefined,
		validImageFetch,
	)
	assert.equal(media.isSuccess, true)
	if (media.isSuccess) {
		assert.equal(media.mimeType, 'image/png')
		assert.deepEqual([...media.bytes], [1, 2, 3])
	}
})

test('media hydration preserves partial successes and appends one note', async () => {
	const payload = JSON.stringify({
		status: {
			media: {
				photos: [
					{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' },
					{ type: 'photo', url: 'https://pbs.twimg.com/b.jpg' },
				],
			},
			text: 'tweet',
		},
	})
	const hydrated = await hydrateTweetMedia(
		[{ text: payload, type: 'text' }],
		{ imageCount: 2, source: 'fetch_content' },
		undefined,
		partialImageFetcher,
	)
	assert.equal(
		hydrated?.content.filter(block => block.type === 'image').length,
		1,
	)
	assert.equal(
		hydrated?.content.filter(
			block =>
				block.type === 'text' && block.text.startsWith('Tweet media:'),
		).length,
		1,
	)
	assert.deepEqual(hydrated?.details, {
		hasImage: true,
		imageCount: 3,
		source: 'fetch_content',
		twitterMedia: ['photo 1: 640×480', 'photo 2: failed (network failure)'],
	})
})

test('tweet media collection deduplicates URLs and observes its limit', () => {
	const payload = {
		status: {
			media: {
				photos: [
					{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' },
					{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' },
					{
						altText: 'diagram',
						type: 'photo',
						url: 'https://pbs.twimg.com/b.jpg',
					},
				],
			},
		},
	}
	assert.deepEqual(collectTweetMedia(payload, 1), [
		{ label: 'photo 1', url: 'https://pbs.twimg.com/a.jpg' },
	])
})

test('FxTwitter JSON parser ignores fetch_content truncation metadata', () => {
	const payload = parseFxTwitterPayload(
		'{"status":{"text":"ok"}}\n\n---\nmetadata',
	)
	assert.deepEqual(payload, { status: { text: 'ok' } })
})
