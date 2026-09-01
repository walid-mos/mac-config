import assert from 'node:assert/strict'
import test from 'node:test'

import { terminalLineWidth } from '../extensions/ui/terminal-text.ts'
import {
	createRotation,
	WORD_ROTATION_INTERVAL_MS,
} from '../extensions/working-loader/rotation.ts'
import {
	createShuffleBag,
	type NonEmptyArray,
} from '../extensions/working-loader/shuffle-bag.ts'
import {
	createSpinnerRotation,
	SAND_SPINNER,
} from '../extensions/working-loader/spinner.ts'
import {
	appendThinkingDelta,
	createThinkingPreviewTimeline,
	MAX_THINKING_BUFFER_LENGTH,
	MIN_THINKING_REGION_COLUMNS,
	normalizeThinkingText,
	rollingThinkingPreview,
	thinkingRegionWidth,
	THINKING_EXIT_GRACE_MS,
	THINKING_ICON,
	THINKING_INITIAL_PREVIEW_DELAY_MS,
	THINKING_PREVIEW_INTERVAL_MS,
} from '../extensions/working-loader/thinking-preview.ts'
import { WORKING_WORDS } from '../extensions/working-loader/words.ts'

import { fakeScheduler } from './working-loader.test-helpers.ts'

test('shuffle bag yields every word once per cycle without immediate repeats', () => {
	const bag = createShuffleBag(WORKING_WORDS)
	const firstCycle = Array.from({ length: WORKING_WORDS.length }, () =>
		bag.next(),
	)
	assert.deepEqual(firstCycle.toSorted(), WORKING_WORDS.toSorted())
	const seen = new Set(firstCycle)
	assert.equal(seen.size, WORKING_WORDS.length, 'no repeats inside a cycle')

	const secondCycle = Array.from({ length: WORKING_WORDS.length }, () =>
		bag.next(),
	)
	assert.notEqual(
		secondCycle[0],
		firstCycle[WORKING_WORDS.length - 1],
		'no repeat across cycles',
	)
	assert.deepEqual(secondCycle.toSorted(), WORKING_WORDS.toSorted())
})

test('shuffle bag tolerates a single item', () => {
	const bag = createShuffleBag(['solo'] as unknown as NonEmptyArray<string>)
	assert.equal(bag.next(), 'solo')
	assert.equal(bag.next(), 'solo')
})

test('rotation fires immediately, then per tick, and start is idempotent', () => {
	const { scheduler, timers, fireAll } = fakeScheduler()
	let ticks = 0
	const rotation = createRotation({
		scheduler,
		intervalMs: WORD_ROTATION_INTERVAL_MS,
		advance: () => {
			ticks += 1
		},
	})

	rotation.start()
	assert.equal(ticks, 1, 'immediate first tick')
	rotation.start()
	assert.equal(timers.length, 1, 'no duplicate timer on redundant start')

	fireAll()
	assert.equal(ticks, 2)
	assert.equal(WORD_ROTATION_INTERVAL_MS, 4000)
	assert.equal(timers[0]?.delayMs, WORD_ROTATION_INTERVAL_MS)

	rotation.stop()
	assert.equal(timers[0]?.cleared, true)
	assert.equal(rotation.isRunning(), false)
})

test('sand spinner emits its canonical frames at 80ms and loops', () => {
	const { scheduler, timers, fireAll } = fakeScheduler()
	const frames: string[] = []
	const rotation = createSpinnerRotation({
		scheduler,
		spinner: SAND_SPINNER,
		onFrame: frame => frames.push(frame),
	})

	rotation.start()
	assert.deepEqual(frames, [SAND_SPINNER.frames[0]])
	assert.equal(timers[0]?.delayMs, 80)

	for (let index = 1; index < SAND_SPINNER.frames.length; index += 1)
		fireAll()
	assert.deepEqual(frames, SAND_SPINNER.frames)
	fireAll()
	assert.equal(
		frames.at(-1),
		SAND_SPINNER.frames[0],
		'loops to the first frame',
	)

	rotation.stop()
	assert.equal(timers[0]?.cleared, true)
})

test('thinking preview is safe, bounded, and keeps a rolling tail', () => {
	const source =
		'\x1b[31m## Checking **widget alignment**\n- while reasoning streams\x1b[0m'
	assert.equal(
		normalizeThinkingText(source),
		'Checking widget alignment while reasoning streams',
	)
	const preview = rollingThinkingPreview(source, 24)
	assert.equal(terminalLineWidth(preview), 24)
	assert.match(preview, /^…/u)
	assert.match(preview, /reasoning streams$/u)
	assert.equal(
		rollingThinkingPreview('**First summary**\n\n**Current summary**', 40),
		'Current summary',
		'rolls to the latest summary instead of growing across summaries',
	)
	assert.equal(
		terminalLineWidth(THINKING_ICON),
		1,
		'Nerd Font brain occupies one terminal cell',
	)

	const bounded = appendThinkingDelta(
		'x'.repeat(MAX_THINKING_BUFFER_LENGTH),
		'tail',
	)
	assert.equal(bounded.length, MAX_THINKING_BUFFER_LENGTH)
	assert.match(bounded, /tail$/u)
})

test('thinking region uses the right half with a hard readability minimum', () => {
	assert.equal(thinkingRegionWidth(80, 60), 40)
	assert.equal(thinkingRegionWidth(120, 100), 60)
	assert.equal(thinkingRegionWidth(60, 40), MIN_THINKING_REGION_COLUMNS)
	assert.equal(thinkingRegionWidth(80, MIN_THINKING_REGION_COLUMNS - 1), 0)
})

test('thinking snapshots keep their minimum dwell time through exit', () => {
	const timeline = createThinkingPreviewTimeline()
	assert.equal(timeline.enter(0), true)
	assert.equal(timeline.isVisible(), true)
	assert.equal(
		timeline.visibleBuffer(),
		'',
		'nothing is shown while the first phrase accumulates',
	)

	assert.equal(timeline.append('Inspecting the stream', 100), false)
	assert.equal(
		timeline.tick(100 + THINKING_INITIAL_PREVIEW_DELAY_MS - 1),
		false,
	)
	assert.equal(timeline.tick(100 + THINKING_INITIAL_PREVIEW_DELAY_MS), true)
	assert.equal(timeline.visibleBuffer(), 'Inspecting the stream')

	timeline.append(' and event ordering', 1000)
	assert.equal(
		timeline.requestExit(1200),
		false,
		'exit does not replace a fresh snapshot',
	)
	assert.equal(timeline.tick(1000 + THINKING_PREVIEW_INTERVAL_MS - 1), false)
	assert.equal(timeline.visibleBuffer(), 'Inspecting the stream')
	assert.equal(timeline.tick(1000 + THINKING_PREVIEW_INTERVAL_MS), true)
	assert.equal(
		timeline.visibleBuffer(),
		'Inspecting the stream and event ordering',
	)
	assert.equal(
		timeline.tick(1000 + 2 * THINKING_PREVIEW_INTERVAL_MS - 1),
		false,
	)
	assert.equal(timeline.tick(1000 + 2 * THINKING_PREVIEW_INTERVAL_MS), true)
	assert.equal(timeline.isVisible(), false)
})

test('thinking resumed during exit grace never blinks', () => {
	const timeline = createThinkingPreviewTimeline()
	timeline.append('Short completed thought', 0)
	assert.equal(timeline.requestExit(100), true)
	assert.equal(timeline.enter(500), false)
	assert.equal(timeline.tick(2600), false)
	assert.equal(timeline.isVisible(), true)

	timeline.requestExit(2700)
	assert.equal(timeline.tick(2700 + THINKING_EXIT_GRACE_MS - 1), false)
	assert.equal(timeline.tick(2700 + THINKING_EXIT_GRACE_MS), true)
	assert.equal(timeline.isVisible(), false)
})
