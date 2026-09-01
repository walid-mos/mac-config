import { resizeImage } from '@earendil-works/pi-coding-agent'

import { fetchAllowedMediaBytes } from './media-download.ts'

import type { MediaFailure } from './media-download.ts'
import type { HttpFetch } from './tweet-context.ts'

const MAX_IMAGE_HEIGHT = 2_000
const MAX_IMAGE_WIDTH = 2_000

type TweetImageSuccess = {
	data: string
	height: number
	isSuccess: true
	mimeType: string
	width: number
}

export type TweetImageResult = TweetImageSuccess | MediaFailure

export async function fetchTweetImage(
	url: string,
	signal: AbortSignal | undefined,
	fetcher: HttpFetch = fetch,
): Promise<TweetImageResult> {
	const mediaBytes = await fetchAllowedMediaBytes(url, signal, fetcher)
	if (!mediaBytes.isSuccess) return mediaBytes
	const resizedImage = await resizeImage(
		mediaBytes.bytes,
		mediaBytes.mimeType,
		{
			maxHeight: MAX_IMAGE_HEIGHT,
			maxWidth: MAX_IMAGE_WIDTH,
		},
	)
	if (!resizedImage) return { error: 'could not decode', isSuccess: false }
	return {
		data: resizedImage.data,
		height: resizedImage.height,
		isSuccess: true,
		mimeType: resizedImage.mimeType,
		width: resizedImage.width,
	}
}
