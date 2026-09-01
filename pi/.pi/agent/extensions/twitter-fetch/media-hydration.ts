import {
	collectTweetMedia,
	fxTwitterObject,
	parseFxTwitterPayload,
} from './fx-twitter-data.ts'

const MAX_IMAGES = 6

type ImageContent = {
	data: string
	mimeType: string
	type: 'image'
}

type TextContent = {
	text: string
	type: 'text'
}

export type ToolContent = ImageContent | TextContent

type ImageFetchFailure = {
	error: string
	isSuccess: false
}

type ImageFetchSuccess = {
	data: string
	height: number
	isSuccess: true
	mimeType: string
	width: number
}

export type ImageFetcher = (
	url: string,
	signal: AbortSignal | undefined,
) => Promise<ImageFetchFailure | ImageFetchSuccess>

type HydratedFetchResult = {
	content: ToolContent[]
	details: Record<string, unknown>
}

function toolText(content: readonly ToolContent[]): string {
	return content
		.filter((block): block is TextContent => block.type === 'text')
		.map(block => block.text)
		.join('\n')
}

function existingImageCount(details: unknown): number {
	const imageCount = fxTwitterObject(details)?.imageCount
	if (typeof imageCount !== 'number' || imageCount < 0) return 0
	return imageCount
}

export async function hydrateTweetMedia(
	content: readonly ToolContent[],
	details: unknown,
	signal: AbortSignal | undefined,
	imageFetcher: ImageFetcher,
): Promise<HydratedFetchResult | undefined> {
	const payload = parseFxTwitterPayload(toolText(content))
	if (!payload) return undefined
	const mediaReferences = collectTweetMedia(payload, MAX_IMAGES)
	if (!mediaReferences.length) return undefined
	const hydratedMedia = await Promise.all(
		mediaReferences.map(async mediaReference => ({
			image: await imageFetcher(mediaReference.url, signal),
			mediaReference,
		})),
	)
	const images: ImageContent[] = []
	const notes: string[] = []
	for (const { image, mediaReference } of hydratedMedia) {
		if (!image.isSuccess) {
			notes.push(`${mediaReference.label}: failed (${image.error})`)
			continue
		}
		images.push({
			type: 'image',
			data: image.data,
			mimeType: image.mimeType,
		})
		notes.push(`${mediaReference.label}: ${image.width}×${image.height}`)
	}
	const note: TextContent = {
		text: `Tweet media: ${notes.join('; ')}`,
		type: 'text',
	}
	const originalDetails = fxTwitterObject(details) ?? {}
	const imageCount = existingImageCount(details) + images.length
	return {
		content: [...images, ...content, note],
		details: {
			...originalDetails,
			hasImage: imageCount > 0,
			imageCount,
			twitterMedia: notes,
		},
	}
}
