const MAX_QUOTE_DEPTH = 3
const FIRST_QUOTE_DEPTH = 0

export type FxTwitterObject = Record<string, unknown>
export type TweetMediaReference = { label: string; url: string }

function isFxTwitterObject(candidate: unknown): candidate is FxTwitterObject {
	return (
		Boolean(candidate) &&
		typeof candidate === 'object' &&
		!Array.isArray(candidate)
	)
}

export function fxTwitterObject(
	candidate: unknown,
): FxTwitterObject | undefined {
	if (!isFxTwitterObject(candidate)) return undefined
	return candidate
}

export function fxTwitterString(
	record: FxTwitterObject | undefined,
	fieldName: string,
): string | undefined {
	const field = record?.[fieldName]
	if (typeof field !== 'string' || !field) return undefined
	return field
}

export function parseFxTwitterPayload(text: string): unknown {
	const [document = ''] = text.split(/\n\n---\n/, 1)
	const jsonStart = document.indexOf('{')
	if (jsonStart < 0) return undefined
	try {
		const payload: unknown = JSON.parse(document.slice(jsonStart))
		return payload
	} catch {
		return undefined
	}
}

function appendUniqueMedia(
	mediaReferences: TweetMediaReference[],
	seenUrls: Set<string>,
	url: string | undefined,
	label: string,
): void {
	if (!url || seenUrls.has(url)) return
	seenUrls.add(url)
	mediaReferences.push({ label, url })
}

function mediaLabel(
	prefix: string,
	kind: string,
	position: number,
	alternativeText?: string,
): string {
	const baseLabel = `${prefix}${kind} ${position}`
	if (!alternativeText) return baseLabel
	return `${baseLabel} (${alternativeText})`
}

function collectPhotos(
	media: FxTwitterObject | undefined,
	state: MediaCollectionState,
	prefix: string,
): void {
	const photos = media?.photos
	if (!Array.isArray(photos)) return
	for (const [index, photo] of photos.entries()) {
		const photoRecord = fxTwitterObject(photo)
		const kind =
			fxTwitterString(photoRecord, 'type') === 'gif' ? 'GIF' : 'photo'
		appendUniqueMedia(
			state.mediaReferences,
			state.seenUrls,
			fxTwitterString(photoRecord, 'url'),
			mediaLabel(
				prefix,
				kind,
				index + 1,
				fxTwitterString(photoRecord, 'altText'),
			),
		)
	}
}

function collectVideos(
	media: FxTwitterObject | undefined,
	state: MediaCollectionState,
	prefix: string,
): void {
	const videos = media?.videos
	if (!Array.isArray(videos)) return
	for (const [index, video] of videos.entries()) {
		appendUniqueMedia(
			state.mediaReferences,
			state.seenUrls,
			fxTwitterString(fxTwitterObject(video), 'thumbnail_url'),
			`${prefix}video ${index + 1} poster`,
		)
	}
}

function collectFallbackMedia(
	status: FxTwitterObject,
	media: FxTwitterObject | undefined,
	state: MediaCollectionState,
	prefix: string,
): void {
	const external = fxTwitterObject(media?.external)
	appendUniqueMedia(
		state.mediaReferences,
		state.seenUrls,
		fxTwitterString(external, 'thumbnail_url'),
		`${prefix}external video poster`,
	)
	const photos = media?.photos
	if (!Array.isArray(photos) || !photos.length) {
		const mosaic = fxTwitterObject(media?.mosaic)
		const formats = fxTwitterObject(mosaic?.formats)
		appendUniqueMedia(
			state.mediaReferences,
			state.seenUrls,
			fxTwitterString(formats, 'jpeg') ?? fxTwitterString(mosaic, 'url'),
			`${prefix}mosaic`,
		)
	}
	const cardImage = fxTwitterObject(fxTwitterObject(status.card)?.image)
	appendUniqueMedia(
		state.mediaReferences,
		state.seenUrls,
		fxTwitterString(cardImage, 'url'),
		`${prefix}card`,
	)
}

type MediaCollectionState = {
	mediaReferences: TweetMediaReference[]
	seenUrls: Set<string>
}

type StatusCollectionRequest = {
	depth: number
	prefix: string
	status: unknown
}

function collectStatusMedia(
	request: StatusCollectionRequest,
	state: MediaCollectionState,
): void {
	const status = fxTwitterObject(request.status)
	if (!status) return
	const media = fxTwitterObject(status.media)
	collectPhotos(media, state, request.prefix)
	collectVideos(media, state, request.prefix)
	collectFallbackMedia(status, media, state, request.prefix)
	if (request.depth >= MAX_QUOTE_DEPTH) return
	const nextDepth = request.depth + 1
	const quotePrefix =
		request.depth === FIRST_QUOTE_DEPTH ? 'quoted ' : `quoted ${nextDepth} `
	collectStatusMedia(
		{ depth: nextDepth, prefix: quotePrefix, status: status.quote },
		state,
	)
}

export function collectTweetMedia(
	payload: unknown,
	maximumMedia: number,
): TweetMediaReference[] {
	const root = fxTwitterObject(payload)
	if (!root) return []
	const state: MediaCollectionState = {
		mediaReferences: [],
		seenUrls: new Set<string>(),
	}
	collectStatusMedia(
		{ depth: FIRST_QUOTE_DEPTH, prefix: '', status: root.status },
		state,
	)
	if (Array.isArray(root.thread)) {
		for (const [index, threadStatus] of root.thread.entries()) {
			collectStatusMedia(
				{
					depth: FIRST_QUOTE_DEPTH,
					prefix: `thread ${index + 1} `,
					status: threadStatus,
				},
				state,
			)
		}
	}
	return state.mediaReferences.slice(0, maximumMedia)
}
