import type { NonEmptyArray } from './shuffle-bag.ts'

/**
 * Loader vocabulary: serious verbs first, then the nonsense words that made
 * the original module charming. Keep both flavors — the shuffle bag mixes
 * them uniformly.
 */
export const WORKING_WORDS = [
	'Pondering',
	'Cogitating',
	'Contemplating',
	'Deliberating',
	'Ruminating',
	'Mulling',
	'Brewing',
	'Distilling',
	'Synthesizing',
	'Weaving',
	'Parsing',
	'Mapping',
	'Tracing',
	'Sifting',
	'Noodling',
	'Tinkering',
	'Harmonizing',
	'Recalibrating',
	'Reconciling',
	'Assembling',
	'Sketching',
	'Unwinding',
	'Figuring',
	'Connecting',
	'Exploring',
	'Scrutinizing',
	'Sloubagoubliming',
	'Flibbertigibbering',
	'Wibblywobbling',
	'Gubberwocking',
	'Snorkelwhiffling',
	'Quibblenoodling',
	'Fiddlefaddling',
	'Twiddlethinking',
	'Blorplewaffling',
	'Zorblaxing',
] as const satisfies NonEmptyArray<string>
