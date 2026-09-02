/** TypeBox schema for the ask_user_question tool parameters. */

import { Type } from 'typebox'

const QuestionOptionSchema = Type.Object({
	value: Type.Optional(
		Type.String({
			description:
				'The value returned when selected (defaults to label when omitted)',
			minLength: 1,
		}),
	),
	label: Type.String({
		description: 'Short display label for the option',
		minLength: 1,
	}),
	description: Type.Optional(
		Type.String({ description: 'Optional explanation shown below label' }),
	),
	recommended: Type.Optional(
		Type.Boolean({
			description:
				'Mark this option as the recommended choice (shows a badge)',
		}),
	),
})

const QuestionSchema = Type.Object({
	id: Type.String({
		description: 'Unique identifier for this question',
		minLength: 1,
	}),
	label: Type.Optional(
		Type.String({
			description:
				"Short contextual label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2)",
			minLength: 1,
		}),
	),
	prompt: Type.String({
		description: 'The full question text to display',
		minLength: 1,
	}),
	options: Type.Optional(
		Type.Array(QuestionOptionSchema, {
			description:
				'Available options to choose from (2-5 recommended). Omit for open-ended questions: shows only a free-text editor.',
		}),
	),
	multiSelect: Type.Optional(
		Type.Boolean({
			description:
				'Allow selecting multiple options (Space toggles, Enter confirms)',
		}),
	),
	allowOther: Type.Optional(
		Type.Boolean({
			description: "Allow 'Type something' option (default: true)",
		}),
	),
})

export const AskParams = Type.Object({
	questions: Type.Array(QuestionSchema, {
		description:
			"Questions to ask the user. Ask only what's needed: 2-3 is usually enough, 5 max.",
		minItems: 1,
		maxItems: 5,
	}),
})
