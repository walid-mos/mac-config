import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPTS = fileURLToPath(
	new URL('../skills/exhaustive-review/scripts/', import.meta.url),
)
const INVENTORY = join(SCRIPTS, 'inventory.sh')
const COVERAGE = join(SCRIPTS, 'coverage.sh')
const SIZE_GATE = join(SCRIPTS, 'size-gate.sh')

type RunResult = {
	status: number | null
	stdout: string
	stderr: string
}

type ManifestRecord = {
	objective: string
	path: string
	verdict: string
	note: string
}

function envFor(scratch: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		TMPDIR: scratch,
		HOME: scratch,
		GIT_CONFIG_NOSYSTEM: '1',
		GIT_CONFIG_GLOBAL: '/dev/null',
		GIT_TERMINAL_PROMPT: '0',
		GIT_AUTHOR_NAME: 'Review Tests',
		GIT_AUTHOR_EMAIL: 'review-tests@example.com',
		GIT_COMMITTER_NAME: 'Review Tests',
		GIT_COMMITTER_EMAIL: 'review-tests@example.com',
	}
}

function run(
	script: string,
	args: readonly string[],
	cwd: string,
	scratch: string,
): RunResult {
	const result = spawnSync('bash', [script, ...args], {
		cwd,
		encoding: 'utf8',
		env: envFor(scratch),
	})
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
	}
}

function git(cwd: string, scratch: string, args: readonly string[]): string {
	const result = spawnSync('git', [...args], {
		cwd,
		encoding: 'utf8',
		env: envFor(scratch),
	})
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout)
	}
	return result.stdout.trim()
}

function writeLines(path: string, count: number): void {
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(
		path,
		`${Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n')}\n`,
	)
}

function reviewIdOf(stdout: string): string {
	const match = stdout.match(
		/^review-id: (pi-exhaustive-review\.[A-Za-z0-9]+)$/m,
	)
	assert.ok(match?.[1], `missing review-id in:\n${stdout}`)
	return match[1]
}

function manifestPath(scratch: string, reviewId: string): string {
	return join(scratch, reviewId, 'manifest.jsonl')
}

function parseManifest(path: string): ManifestRecord[] {
	return readFileSync(path, 'utf8')
		.split('\n')
		.filter(line => line.length > 0)
		.map(line => JSON.parse(line) as ManifestRecord)
}

function writeManifest(path: string, records: ManifestRecord[]): void {
	writeFileSync(
		path,
		`${records
			.map(record =>
				JSON.stringify(record, [
					'objective',
					'path',
					'verdict',
					'note',
				]),
			)
			.join('\n')}\n`,
	)
}

function withRepo(runTest: (repo: string, scratch: string) => void): void {
	const repo = mkdtempSync(join(tmpdir(), 'exhaustive-review-repo-'))
	const scratch = mkdtempSync(join(tmpdir(), 'exhaustive-review-tmp-'))
	try {
		git(repo, scratch, ['init', '-b', 'main'])
		git(repo, scratch, ['config', 'user.email', 'review-tests@example.com'])
		git(repo, scratch, ['config', 'user.name', 'Review Tests'])
		git(repo, scratch, ['config', 'commit.gpgsign', 'false'])
		runTest(repo, scratch)
	} finally {
		rmSync(repo, { recursive: true, force: true })
		rmSync(scratch, { recursive: true, force: true })
	}
}

test('inventory selects explicit path/range/commit including a deletion', () => {
	withRepo((repo, scratch) => {
		writeLines(join(repo, 'src/keep.ts'), 2)
		writeLines(join(repo, 'src/gone.ts'), 2)
		git(repo, scratch, ['add', 'src/keep.ts', 'src/gone.ts'])
		git(repo, scratch, ['commit', '-m', 'base'])

		rmSync(join(repo, 'src/gone.ts'))
		git(repo, scratch, ['add', '-A'])
		git(repo, scratch, ['commit', '-m', 'delete gone'])
		const deleteSha = git(repo, scratch, ['rev-parse', 'HEAD'])

		writeLines(join(repo, 'src/ranged.ts'), 2)
		git(repo, scratch, ['add', 'src/ranged.ts'])
		git(repo, scratch, ['commit', '-m', 'range add'])
		const rangeSha = git(repo, scratch, ['rev-parse', 'HEAD'])

		writeLines(join(repo, 'src/outside.ts'), 2)
		git(repo, scratch, ['add', 'src/outside.ts'])
		git(repo, scratch, ['commit', '-m', 'outside'])

		const first = run(
			INVENTORY,
			[
				'--objective',
				'bugs',
				'--path',
				'src/keep.ts',
				'--range',
				`${deleteSha}..${rangeSha}`,
				'--commit',
				deleteSha,
			],
			repo,
			scratch,
		)
		assert.equal(first.status, 0, first.stderr)
		const firstId = reviewIdOf(first.stdout)
		const firstManifest = manifestPath(scratch, firstId)
		assert.ok(firstManifest.startsWith(scratch))
		assert.ok(existsSync(firstManifest))
		assert.equal(existsSync(join(repo, '.review-manifest.csv')), false)

		const records = parseManifest(firstManifest)
		assert.deepEqual(
			new Set(records.map(record => record.path)),
			new Set(['src/keep.ts', 'src/gone.ts', 'src/ranged.ts']),
		)
		for (const record of records) {
			assert.equal(record.objective, 'bugs')
			assert.equal(record.verdict, 'pending')
			assert.equal(record.note, '')
		}

		const second = run(
			INVENTORY,
			['--objective', 'bugs', '--path', 'src/keep.ts'],
			repo,
			scratch,
		)
		assert.equal(second.status, 0, second.stderr)
		const secondId = reviewIdOf(second.stdout)
		assert.notEqual(secondId, firstId)
		assert.ok(existsSync(firstManifest))
		assert.ok(existsSync(manifestPath(scratch, secondId)))

		const custom = run(
			INVENTORY,
			[
				'--objective',
				'bugs',
				'--path',
				'src/keep.ts',
				join(scratch, 'custom-manifest.jsonl'),
			],
			repo,
			scratch,
		)
		assert.equal(custom.status, 2)
		assert.equal(existsSync(join(scratch, 'custom-manifest.jsonl')), false)
		assert.match(custom.stderr, /unknown argument/)

		const emptyDir = join(repo, 'empty-scope')
		mkdirSync(emptyDir)
		const empty = run(
			INVENTORY,
			['--objective', 'bugs', '--path', 'empty-scope'],
			repo,
			scratch,
		)
		assert.notEqual(empty.status, 0)
		const missing = run(
			INVENTORY,
			['--objective', 'bugs', '--path', 'no-such-path.ts'],
			repo,
			scratch,
		)
		assert.notEqual(missing.status, 0)
		const none = run(INVENTORY, ['--objective', 'bugs'], repo, scratch)
		assert.equal(none.status, 2)
	})
})

test('coverage checks verdicts, skip reasons, exact scope, and deletes state', () => {
	withRepo((repo, scratch) => {
		writeLines(join(repo, 'src/keep.ts'), 2)
		writeLines(join(repo, 'src/extra.ts'), 2)
		git(repo, scratch, ['add', 'src/keep.ts', 'src/extra.ts'])
		git(repo, scratch, ['commit', '-m', 'files'])
		const selectors = ['--path', 'src/keep.ts'] as const

		const pendingInventory = run(
			INVENTORY,
			['--objective', 'bugs', ...selectors],
			repo,
			scratch,
		)
		assert.equal(pendingInventory.status, 0, pendingInventory.stderr)
		const pendingId = reviewIdOf(pendingInventory.stdout)
		const pendingDir = join(scratch, pendingId)
		const pending = run(
			COVERAGE,
			['--review-id', pendingId, ...selectors],
			repo,
			scratch,
		)
		assert.notEqual(pending.status, 0)
		assert.equal(existsSync(pendingDir), false)

		const skipInventory = run(
			INVENTORY,
			['--objective', 'bugs', ...selectors],
			repo,
			scratch,
		)
		assert.equal(skipInventory.status, 0, skipInventory.stderr)
		const skipId = reviewIdOf(skipInventory.stdout)
		const skipManifest = manifestPath(scratch, skipId)
		const skipRecords = parseManifest(skipManifest)
		skipRecords[0]!.verdict = 'skip'
		writeManifest(skipManifest, skipRecords)
		const skipBare = run(
			COVERAGE,
			['--review-id', skipId, ...selectors],
			repo,
			scratch,
		)
		assert.notEqual(skipBare.status, 0)
		assert.match(skipBare.stderr, /skips without a reason/)
		assert.equal(existsSync(join(scratch, skipId)), false)

		const reasonedInventory = run(
			INVENTORY,
			['--objective', 'bugs', ...selectors],
			repo,
			scratch,
		)
		assert.equal(reasonedInventory.status, 0, reasonedInventory.stderr)
		const reasonedId = reviewIdOf(reasonedInventory.stdout)
		const reasonedManifest = manifestPath(scratch, reasonedId)
		const reasoned = parseManifest(reasonedManifest)
		reasoned[0]!.verdict = 'skip'
		reasoned[0]!.note = 'generated fixture'
		writeManifest(reasonedManifest, reasoned)
		const skipOk = run(
			COVERAGE,
			['--review-id', reasonedId, ...selectors],
			repo,
			scratch,
		)
		assert.equal(skipOk.status, 0, skipOk.stderr)
		assert.equal(existsSync(join(scratch, reasonedId)), false)

		const driftInventory = run(
			INVENTORY,
			['--objective', 'bugs', ...selectors],
			repo,
			scratch,
		)
		assert.equal(driftInventory.status, 0, driftInventory.stderr)
		const driftId = reviewIdOf(driftInventory.stdout)
		const driftManifest = manifestPath(scratch, driftId)
		const driftRecords = parseManifest(driftManifest)
		driftRecords[0]!.verdict = 'done'
		writeManifest(driftManifest, driftRecords)
		const drifted = run(
			COVERAGE,
			[
				'--review-id',
				driftId,
				'--path',
				'src/keep.ts',
				'--path',
				'src/extra.ts',
			],
			repo,
			scratch,
		)
		assert.notEqual(drifted.status, 0)
		assert.match(drifted.stderr, /scope changed/)
		assert.equal(existsSync(join(scratch, driftId)), false)

		const invalid = run(
			COVERAGE,
			['--review-id', 'not-a-review'],
			repo,
			scratch,
		)
		assert.equal(invalid.status, 2)
	})
})

test('size-gate uses a hard 250 budget and a precise test-path exemption', () => {
	withRepo((repo, scratch) => {
		writeLines(join(repo, 'src/contest.ts'), 251)
		writeLines(join(repo, 'src/widget.test.ts'), 251)
		writeLines(join(repo, 'src/ok.ts'), 250)
		git(repo, scratch, [
			'add',
			'src/contest.ts',
			'src/widget.test.ts',
			'src/ok.ts',
		])
		git(repo, scratch, ['commit', '-m', 'sized files'])

		const over = run(SIZE_GATE, ['--path', 'src/contest.ts'], repo, scratch)
		assert.equal(over.status, 1)
		assert.match(over.stdout, /OVER BUDGET/)

		const exempt = run(
			SIZE_GATE,
			['--path', 'src/widget.test.ts'],
			repo,
			scratch,
		)
		assert.equal(exempt.status, 0, exempt.stderr)
		assert.match(exempt.stdout, /hard budget 250/)

		const atCap = run(SIZE_GATE, ['--path', 'src/ok.ts'], repo, scratch)
		assert.equal(atCap.status, 0, atCap.stderr)

		const tooHigh = run(
			SIZE_GATE,
			['--budget', '251', '--path', 'src/ok.ts'],
			repo,
			scratch,
		)
		assert.equal(tooHigh.status, 2)
		assert.match(tooHigh.stderr, /1 to 250/)

		const invalid = run(
			SIZE_GATE,
			['--budget', 'abc', '--path', 'src/ok.ts'],
			repo,
			scratch,
		)
		assert.equal(invalid.status, 2)

		const zero = run(
			SIZE_GATE,
			['--budget', '0', '--path', 'src/ok.ts'],
			repo,
			scratch,
		)
		assert.equal(zero.status, 2)
	})
})
