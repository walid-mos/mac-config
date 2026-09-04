import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createCapturePromptEditor } from '../extensions/capture-prompt/editor.ts'
import { CaptureStore } from '../extensions/capture-prompt/store.ts'
import { createDoubleEscapeEditor } from '../extensions/double-escape/editor.ts'

import type { KeybindingsManager } from '@earendil-works/pi-coding-agent'

const PNG_BYTES = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
	'base64',
)
const PNG_BASE64 = PNG_BYTES.toString('base64')
const PNG_IMAGE = {
	type: 'image',
	data: PNG_BASE64,
	mimeType: 'image/png',
}

async function withTempDir(
	run: (directory: string) => Promise<void>,
): Promise<void> {
	const directory = await mkdtemp(join(tmpdir(), 'capture-prompt-'))
	try {
		await run(directory)
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
}

test('valid PNG path and shell-escaped path become sequential aliases', async () => {
	await withTempDir(async directory => {
		const pngPath = join(directory, 'shot.png')
		const spacedPath = join(directory, 'shot 2.png')
		await writeFile(pngPath, PNG_BYTES)
		await writeFile(spacedPath, PNG_BYTES)
		const store = new CaptureStore(() => {})
		const escapedPath = spacedPath.replaceAll(' ', '\\ ')
		assert.equal(
			store.ingestPaths(`${pngPath} ${escapedPath}`, directory),
			'[img:1] [img:2]',
		)
		assert.equal(store.ingestPaths(`'${spacedPath}'`, directory), '[img:3]')
		assert.deepEqual(store.imagesFor('[img:1] [img:2] [img:3]'), [
			PNG_IMAGE,
			PNG_IMAGE,
			PNG_IMAGE,
		])
	})
})

test('PNG path after prefix and trailing comma becomes an alias', async () => {
	await withTempDir(async directory => {
		const pngPath = join(directory, 'shot.png')
		await writeFile(pngPath, PNG_BYTES)
		const store = new CaptureStore(() => {})
		assert.equal(
			store.ingestPaths(`look:${pngPath},`, directory),
			'look:[img:1],',
		)
	})
})

test('non-image paths stay unchanged', async () => {
	await withTempDir(async directory => {
		const notesPath = join(directory, 'notes.txt')
		await writeFile(notesPath, 'not an image\n')
		const store = new CaptureStore(() => {})
		assert.equal(
			store.ingestPaths(`${notesPath} hello`, directory),
			`${notesPath} hello`,
		)
		assert.deepEqual(store.imagesFor(notesPath), [])
	})
})

test('retainAliases removes unused images and resets numbering', async () => {
	await withTempDir(async directory => {
		const first = join(directory, 'first.png')
		const second = join(directory, 'second.png')
		await writeFile(first, PNG_BYTES)
		await writeFile(second, PNG_BYTES)
		const store = new CaptureStore(() => {})
		store.ingestPaths(`${first} ${second}`, directory)
		store.retainAliases('[img:2]')
		assert.deepEqual(
			store.items.map(item => item.alias),
			['[img:2]'],
		)
		store.retainAliases('')
		assert.deepEqual(store.items, [])
		assert.equal(store.ingestPaths(first, directory), '[img:1]')
	})
})

test('prepareSubmission snapshot still returns image after retainAliases clears', async () => {
	await withTempDir(async directory => {
		const pngPath = join(directory, 'shot.png')
		await writeFile(pngPath, PNG_BYTES)
		const store = new CaptureStore(() => {})
		const text = store.ingestPaths(pngPath, directory)
		store.prepareSubmission(text)
		store.retainAliases('')
		assert.deepEqual(store.imagesFor(text), [PNG_IMAGE])
	})
})

test('render styles sequential image aliases in wrapped editor output', () => {
	const fake = {
		actionHandlers: new Map(),
		render: () => ['say [img:1] then [img:22]'],
		getText() {},
		setText() {},
		handleInput() {},
		invalidate() {},
	}
	const editor = createCapturePromptEditor(
		fake,
		new CaptureStore(() => {}),
		process.cwd(),
		{ matches: () => false } as never,
		alias => `<b>${alias}</b>`,
	)
	assert.deepEqual(editor.render(80), [
		'say <b>[img:1]</b> then <b>[img:22]</b>',
	])
})

test('trailing alias is deleted atomically on backspace', async () => {
	await withTempDir(async directory => {
		const pngPath = join(directory, 'shot.png')
		await writeFile(pngPath, PNG_BYTES)
		const store = new CaptureStore(() => {})
		store.ingestPaths(pngPath, directory)
		let text = 'ask [img:1]'
		const fake = {
			actionHandlers: new Map(),
			onChange: undefined as ((value: string) => void) | undefined,
			getText() {
				return text
			},
			setText(value: string) {
				text = value
				this.onChange?.(value)
			},
			handleInput() {
				text = text.slice(0, -1)
				this.onChange?.(text)
			},
			render() {},
			invalidate() {},
		}
		const editor = createCapturePromptEditor(
			fake,
			store,
			directory,
			{ matches: () => true } as never,
			() => {},
		)
		editor.handleInput('backspace')
		assert.equal(text, 'ask ')
		assert.deepEqual(store.items, [])
	})
})

for (const captureOutside of [false, true]) {
	test(`capture and double-escape compose with capture outside=${captureOutside}`, async () => {
		await withTempDir(async directory => {
			const pngPath = join(directory, 'shot.png')
			await writeFile(pngPath, PNG_BYTES)
			const store = new CaptureStore(() => {})
			const keybindings = {
				matches: (data: string, action: string) =>
					data === 'escape' && action === 'app.interrupt',
			} as KeybindingsManager
			const base = {
				actionHandlers: new Map(),
				text: '',
				onChange: undefined as ((text: string) => void) | undefined,
				onSubmit: undefined as ((text: string) => void) | undefined,
				getText() {
					return this.text
				},
				setText(text: string) {
					this.text = text
					this.onChange?.(text)
				},
				handleInput(data: string) {
					if (data === 'submit') this.onSubmit?.(this.text)
				},
				render() {
					return [this.text]
				},
				invalidate() {},
			}
			const captureBase = captureOutside
				? createDoubleEscapeEditor(base, keybindings, () => 0)
				: base
			const capture = createCapturePromptEditor(
				captureBase,
				store,
				directory,
				keybindings,
				alias => `<b>${alias}</b>`,
			)
			const editor = captureOutside
				? capture
				: createDoubleEscapeEditor(capture, keybindings, () => 0)
			const changes: string[] = []
			editor.onChange = text => {
				changes.push(text)
			}
			editor.onSubmit = text => {
				editor.setText('')
				assert.deepEqual(store.imagesFor(text), [PNG_IMAGE])
			}
			editor.setText(pngPath)
			assert.equal(editor.getText(), '[img:1]')
			assert.deepEqual(changes, ['[img:1]'])
			assert.deepEqual(editor.render(80), ['<b>[img:1]</b>'])
			editor.handleInput('submit')
			assert.equal(editor.getText(), '')
			assert.deepEqual(store.items, [])
			editor.setText(pngPath)
			editor.handleInput('escape')
			editor.handleInput('escape')
			assert.equal(editor.getText(), '')
			assert.deepEqual(store.items, [])
		})
	})
}
