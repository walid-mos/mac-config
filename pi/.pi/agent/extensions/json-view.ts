/** json-view : détection, formatage et inspection des blocs JSON du transcript. */
export { extractJsonBlocks, findBalancedEnd, MIN_RAW_LENGTH, type JsonBlock } from "./json-view/detect.ts";
export {
	COLLAPSED_LINE_THRESHOLD,
	formatJsonBytes,
	renderJsonBlock,
	transformMarkdown,
} from "./json-view/render.ts";
export { persistJson, recentBlobs, setBlobDir, type JsonBlob } from "./json-view/blob-store.ts";
export { registerJsonViewExtension as default } from "./json-view/runtime.ts";
