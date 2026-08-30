import type { NonEmptyArray } from "./shuffle-bag.ts";

/**
 * Loader vocabulary: serious verbs first, then the nonsense words that made
 * the original module charming. Keep both flavors — the shuffle bag mixes
 * them uniformly.
 */
export const WORKING_WORDS = [
	"Pondering",
	"Cogitating",
	"Contemplating",
	"Deliberating",
	"Ruminating",
	"Mulling",
	"Brewing",
	"Distilling",
	"Synthesizing",
	"Weaving",
	"Parsing",
	"Mapping",
	"Tracing",
	"Sifting",
	"Noodling",
	"Tinkering",
	"Harmonizing",
	"Recalibrating",
	"Reconciling",
	"Assembling",
	"Sketching",
	"Unwinding",
	"Figuring",
	"Connecting",
	"Exploring",
	"Scrutinizing",
	"Sloubagoubliming",
	"Flibbertigibbering",
	"Wibblywobbling",
	"Gubberwocking",
	"Snorkelwhiffling",
	"Quibblenoodling",
	"Fiddlefaddling",
	"Twiddlethinking",
	"Blorplewaffling",
	"Zorblaxing",
] as const satisfies NonEmptyArray<string>;

/**
 * Reasoning vocabulary: shown while thinking blocks stream, so the loader
 * says *what* the model is doing instead of hiding the pause. Same flavor
 * split as WORKING_WORDS.
 */
export const THINKING_WORDS = [
	"Reasoning",
	"Weighing",
	"Deducing",
	"Theorizing",
	"Reflecting",
	"Inferencing",
	"Musing",
	"Puzzling",
	"Philosophizing",
	"Considering",
	"ChainsOfThoughting",
	"Grokking",
	"NeuronSparking",
	"MindWandering",
	"Deep-diving",
] as const satisfies NonEmptyArray<string>;
