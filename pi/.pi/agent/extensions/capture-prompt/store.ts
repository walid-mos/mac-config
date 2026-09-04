import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

import type { ImageContent } from '@earendil-works/pi-ai'

const SHELL_WORD = /"(?:\\.|[^"\\])*"|'[^']*'|(?:\\.|[^\s])+/gu
const ALIAS = /\[img:(\d+)\]/gu
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export type PromptCapture = ImageContent & {
	alias: string
	filePath: string
	imageId: number
}

export class CaptureStore {
	private captures: PromptCapture[] = []
	private nextNumber = 1
	private offset = 0
	private prepared: { text: string; images: ImageContent[] } | undefined
	private readonly onChange: () => void

	constructor(onChange: () => void) {
		this.onChange = onChange
	}

	get items(): readonly PromptCapture[] {
		return this.captures
	}

	get scrollOffset(): number {
		return this.offset
	}

	ingestPaths(text: string, cwd: string): string {
		let changed = false
		const rewritten = text.replace(SHELL_WORD, token => {
			const ingested = ingestToken(token, cwd, this.nextNumber)
			if (!ingested) return token
			this.nextNumber += 1
			this.captures.push(ingested.capture)
			changed = true
			return ingested.text
		})
		if (changed) this.onChange()
		return rewritten
	}

	retainAliases(text: string): void {
		const aliases = new Set(
			[...text.matchAll(ALIAS)].map(match => match[0]),
		)
		const retained = this.captures.filter(capture =>
			aliases.has(capture.alias),
		)
		if (retained.length === this.captures.length) return
		this.captures = retained
		this.offset = Math.min(this.offset, Math.max(0, retained.length - 1))
		if (retained.length === 0) this.nextNumber = 1
		this.onChange()
	}

	prepareSubmission(text: string): void {
		this.prepared = { text, images: this.currentImagesFor(text) }
	}

	imagesFor(text: string): ImageContent[] {
		if (this.prepared?.text === text) {
			const { images } = this.prepared
			this.prepared = undefined
			return images
		}
		return this.currentImagesFor(text)
	}

	private currentImagesFor(text: string): ImageContent[] {
		return this.captures
			.filter(capture => text.includes(capture.alias))
			.map(({ data, mimeType }) => ({ type: 'image', data, mimeType }))
	}

	scroll(delta: number): void {
		const next = Math.max(
			0,
			Math.min(this.captures.length - 1, this.offset + delta),
		)
		if (next === this.offset) return
		this.offset = next
		this.onChange()
	}
}

function ingestToken(
	token: string,
	cwd: string,
	number: number,
): { capture: PromptCapture; text: string } | undefined {
	const decoded = decodeShellWord(token)
	for (const start of pathStartIndexes(decoded)) {
		for (const end of pathEndIndexes(decoded, start)) {
			const capture = readCapture(decoded.slice(start, end), cwd, number)
			if (!capture) continue
			return {
				capture,
				text: `${decoded.slice(0, start)}${capture.alias}${decoded.slice(end)}`,
			}
		}
	}
	return undefined
}

function readCapture(
	value: string,
	cwd: string,
	number: number,
): PromptCapture | undefined {
	if (!looksLikePath(value)) return undefined
	const filePath = resolvePath(value, cwd)
	try {
		const stats = statSync(filePath)
		if (!stats.isFile() || stats.size === 0 || stats.size > MAX_IMAGE_BYTES)
			return undefined
		const bytes = readFileSync(filePath)
		const mimeType = detectImageMimeType(bytes)
		if (!mimeType) return undefined
		return {
			type: 'image',
			data: bytes.toString('base64'),
			mimeType,
			alias: `[img:${String(number)}]`,
			filePath,
			imageId: Math.floor(Math.random() * 0xfffffffe) + 1,
		}
	} catch {
		return undefined
	}
}

function pathStartIndexes(value: string): number[] {
	const indexes = new Set<number>()
	for (let index = 0; index < value.length; index += 1) {
		const suffix = value.slice(index)
		if (
			suffix.startsWith('/') ||
			suffix.startsWith('./') ||
			suffix.startsWith('../') ||
			suffix.startsWith('~/')
		)
			indexes.add(index)
	}
	return [...indexes]
}

function pathEndIndexes(value: string, start: number): number[] {
	const indexes = [value.length]
	let end = value.length
	while (end > start && /[,.;:!?\])}]/u.test(value[end - 1] ?? '')) {
		end -= 1
		indexes.push(end)
	}
	return indexes
}

function decodeShellWord(token: string): string {
	if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1)
	const unquoted =
		token.startsWith('"') && token.endsWith('"')
			? token.slice(1, -1)
			: token
	return unquoted.replace(/\\(.)/gu, '$1')
}

function looksLikePath(value: string): boolean {
	return (
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../') ||
		value.startsWith('~/')
	)
}

function resolvePath(value: string, cwd: string): string {
	if (value.startsWith('~/')) return resolve(homedir(), value.slice(2))
	return isAbsolute(value) ? resolve(value) : resolve(cwd, value)
}

function detectImageMimeType(bytes: Uint8Array): string | undefined {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
	)
		return 'image/webp'
	return undefined
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
	return signature.every((byte, index) => bytes[index] === byte)
}
