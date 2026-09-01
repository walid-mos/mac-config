type BoundedBytesSuccess = {
	bytes: Uint8Array
	isSuccess: true
}

type BoundedBytesFailure = {
	error: string
	isSuccess: false
}

export type BoundedBytesResult = BoundedBytesSuccess | BoundedBytesFailure

function declaredLength(response: Response): number | undefined {
	const header = response.headers.get('content-length')
	if (!header) return undefined
	const parsedLength = Number.parseInt(header, 10)
	if (!Number.isFinite(parsedLength) || parsedLength < 0) return undefined
	return parsedLength
}

function concatenateChunks(
	chunks: readonly Uint8Array[],
	totalBytes: number,
): Uint8Array {
	const combined = new Uint8Array(totalBytes)
	let offset = 0
	for (const chunk of chunks) {
		combined.set(chunk, offset)
		offset += chunk.byteLength
	}
	return combined
}

type ResponseReadState = {
	chunks: Uint8Array[]
	maximumBytes: number
	totalBytes: number
}

async function readNextChunk(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	state: ResponseReadState,
): Promise<BoundedBytesResult> {
	const chunkRead = await reader.read()
	if (chunkRead.done) {
		return {
			bytes: concatenateChunks(state.chunks, state.totalBytes),
			isSuccess: true,
		}
	}
	const totalBytes = state.totalBytes + chunkRead.value.byteLength
	if (totalBytes > state.maximumBytes) {
		await reader.cancel()
		return { error: 'response too large', isSuccess: false }
	}
	state.chunks.push(chunkRead.value)
	return readNextChunk(reader, { ...state, totalBytes })
}

export async function readBoundedResponse(
	response: Response,
	maximumBytes: number,
): Promise<BoundedBytesResult> {
	const contentLength = declaredLength(response)
	if (contentLength && contentLength > maximumBytes) {
		return { error: 'response too large', isSuccess: false }
	}
	if (!response.body) {
		return { bytes: new Uint8Array(), isSuccess: true }
	}

	const reader = response.body.getReader()
	try {
		return await readNextChunk(reader, {
			chunks: [],
			maximumBytes,
			totalBytes: 0,
		})
	} finally {
		reader.releaseLock()
	}
}
