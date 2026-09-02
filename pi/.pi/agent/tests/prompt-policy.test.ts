import assert from 'node:assert/strict'
import test from 'node:test'

import { applyPiDocumentationPolicy } from '../extensions/prompt-policy.ts'

const SYSTEM_PROMPT = `Guidelines:
- Be concise

Pi documentation (read only when the user asks about pi itself):
- Main documentation: /opt/pi/README.md
- When working on pi topics, read the docs and examples
- Always read pi .md files completely and follow links

<project_context>
repository rules
</project_context>
Current working directory: /repo`

test('removes Pi documentation guidance from unrelated project work', () => {
	const result = applyPiDocumentationPolicy(
		SYSTEM_PROMPT,
		'Fix the payment service timeout',
	)

	assert.doesNotMatch(result, /Pi documentation/u)
	assert.match(result, /<project_context>/u)
	assert.match(result, /Current working directory/u)
})

test('keeps paths but makes reading selective for Pi work', () => {
	const result = applyPiDocumentationPolicy(
		SYSTEM_PROMPT,
		'Create a Pi extension for this workflow',
	)

	assert.match(result, /Main documentation: \/opt\/pi\/README\.md/u)
	assert.match(result, /sections directly relevant/u)
	assert.doesNotMatch(result, /Always read pi \.md files completely/u)
	assert.doesNotMatch(result, /read the docs and examples/u)
})

test('recognizes direct harness configuration work', () => {
	const result = applyPiDocumentationPolicy(
		SYSTEM_PROMPT,
		'Réduis les règles dans AGENTS.md',
	)
	assert.match(result, /Pi documentation/u)
})

test('leaves custom prompts without the Pi block untouched', () => {
	const prompt = 'Custom system prompt\nCurrent working directory: /repo'
	assert.equal(applyPiDocumentationPolicy(prompt, 'ordinary task'), prompt)
})
