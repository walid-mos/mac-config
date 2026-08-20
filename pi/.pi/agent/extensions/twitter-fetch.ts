/**
 * Rewrite X/Twitter status URLs on fetch_content to FxTwitter's JSON API,
 * then attach tweet photos / GIF stills / video posters to the tool result.
 *
 * x.com is a JS shell — local HTTP extraction always comes back empty.
 * The agent must not remember a skill: this hook rewrites and hydrates media.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resizeImage } from "@earendil-works/pi-coding-agent";

const STATUS_RE =
	/(?:https?:\/\/)?(?:www\.)?(?:mobile\.)?(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com)\/(?:(?:i\/web|i)\/status|[^/?#]+\/status)\/(\d+)/i;
const FXTWITTER_API_HOST = "api.fxtwitter.com";
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MEDIA_HOST_SUFFIXES = [".twimg.com", ".fxtwitter.com", ".fixupx.com", ".vxtwitter.com"];
const MEDIA_HOSTS = new Set(["pbs.twimg.com", "video.twimg.com", "abs.twimg.com", "ton.twimg.com"]);

type TextOrImage = {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
};

type MediaItem = { url: string; label: string };

function rewriteTwitterStatusUrl(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const match = raw.match(STATUS_RE);
	if (!match) return undefined;
	const next = `https://api.fxtwitter.com/2/status/${match[1]}`;
	return raw === next ? undefined : next;
}

function isFxTwitterApiUrl(raw: unknown): boolean {
	if (typeof raw !== "string") return false;
	try {
		const url = new URL(raw);
		return url.protocol === "https:" && url.hostname === FXTWITTER_API_HOST;
	} catch {
		return false;
	}
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = record?.[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pushUnique(items: MediaItem[], seen: Set<string>, url: string | undefined, label: string): void {
	if (!url || seen.has(url)) return;
	seen.add(url);
	items.push({ url, label });
}

function collectStatusMedia(status: unknown, items: MediaItem[], seen: Set<string>, prefix: string, depth = 0): void {
	const record = asRecord(status);
	if (!record) return;
	const media = asRecord(record.media);
	const photos = media?.photos;
	if (Array.isArray(photos)) {
		for (const [index, photo] of photos.entries()) {
			const photoRecord = asRecord(photo);
			const kind = stringField(photoRecord, "type") === "gif" ? "GIF" : "photo";
			const alt = stringField(photoRecord, "altText");
			pushUnique(
				items,
				seen,
				stringField(photoRecord, "url"),
				alt ? `${prefix}${kind} ${index + 1} (${alt})` : `${prefix}${kind} ${index + 1}`,
			);
		}
	}
	const videos = media?.videos;
	if (Array.isArray(videos)) {
		for (const [index, video] of videos.entries()) {
			const videoRecord = asRecord(video);
			pushUnique(items, seen, stringField(videoRecord, "thumbnail_url"), `${prefix}video ${index + 1} poster`);
		}
	}
	const external = asRecord(media?.external);
	pushUnique(items, seen, stringField(external, "thumbnail_url"), `${prefix}external video poster`);
	if (!Array.isArray(photos) || photos.length === 0) {
		const mosaic = asRecord(media?.mosaic);
		const formats = asRecord(mosaic?.formats);
		pushUnique(items, seen, stringField(formats, "jpeg") ?? stringField(mosaic, "url"), `${prefix}mosaic`);
	}
	const cardImage = asRecord(asRecord(record.card)?.image);
	pushUnique(items, seen, stringField(cardImage, "url"), `${prefix}card`);
	if (depth >= 3) return;
	const quotePrefix = depth === 0 ? "quoted " : `quoted ${depth + 1} `;
	collectStatusMedia(record.quote, items, seen, quotePrefix, depth + 1);
}

function collectTweetMedia(payload: unknown): MediaItem[] {
	const root = asRecord(payload);
	if (!root) return [];
	const items: MediaItem[] = [];
	const seen = new Set<string>();
	collectStatusMedia(root.status, items, seen, "");
	if (Array.isArray(root.thread)) {
		for (const [index, entry] of root.thread.entries()) {
			collectStatusMedia(entry, items, seen, `thread ${index + 1} `);
		}
	}
	return items.slice(0, MAX_IMAGES);
}

function extractToolText(content: unknown): string {
	if (!Array.isArray(content)) return typeof content === "string" ? content : "";
	return content
		.filter((block): block is TextOrImage => Boolean(block) && typeof block === "object")
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text ?? "")
		.join("\n");
}

function parseFxTwitterPayload(text: string): unknown | undefined {
	const body = text.split(/\n\n---\n/)[0]?.trim() ?? "";
	const start = body.indexOf("{");
	if (start < 0) return undefined;
	try {
		return JSON.parse(body.slice(start));
	} catch {
		return undefined;
	}
}

function allowedMediaHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	return MEDIA_HOSTS.has(host) || MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

async function fetchTweetImage(
	url: string,
	signal: AbortSignal | undefined,
): Promise<{ data: string; mimeType: string; width: number; height: number } | { error: string }> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { error: "invalid URL" };
	}
	if (parsed.protocol !== "https:" || !allowedMediaHost(parsed.hostname)) {
		return { error: `blocked host ${parsed.hostname}` };
	}

	const timeout = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
	const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
	const response = await fetch(parsed, {
		signal: combined,
		redirect: "follow",
		headers: {
			Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
			"User-Agent": "Mozilla/5.0 (compatible; pi-twitter-fetch/1.0)",
		},
	});
	if (!response.ok) return { error: `HTTP ${response.status}` };
	const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
	if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) return { error: `unsupported type ${mimeType || "unknown"}` };

	const buffer = new Uint8Array(await response.arrayBuffer());
	if (buffer.byteLength > MAX_IMAGE_BYTES) return { error: "image too large" };
	const resized = await resizeImage(buffer, mimeType, { maxWidth: 2000, maxHeight: 2000 });
	if (!resized) return { error: "could not decode" };
	return { data: resized.data, mimeType: resized.mimeType, width: resized.width, height: resized.height };
}

function collectedUrls(input: Record<string, unknown>, details: unknown): string[] {
	const urls: string[] = [];
	if (typeof input.url === "string") urls.push(input.url);
	if (Array.isArray(input.urls)) {
		for (const entry of input.urls) {
			if (typeof entry === "string") urls.push(entry);
		}
	}
	const detailRecord = asRecord(details);
	const detailUrls = detailRecord?.urls;
	if (Array.isArray(detailUrls)) {
		for (const entry of detailUrls) {
			if (typeof entry === "string") urls.push(entry);
		}
	}
	return urls;
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "fetch_content") return;

		const input = event.input as Record<string, unknown>;
		let rewritten = false;

		const nextUrl = rewriteTwitterStatusUrl(input.url);
		if (nextUrl) {
			input.url = nextUrl;
			rewritten = true;
		}

		if (Array.isArray(input.urls)) {
			input.urls = input.urls.map((entry) => {
				const next = rewriteTwitterStatusUrl(entry);
				if (!next) return entry;
				rewritten = true;
				return next;
			});
		}

		if (rewritten) delete input.auth;
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "fetch_content" || event.isError) return;

		const input = event.input as Record<string, unknown>;
		const urls = collectedUrls(input, event.details);
		if (!urls.some(isFxTwitterApiUrl)) return;

		const payload = parseFxTwitterPayload(extractToolText(event.content));
		if (!payload) return;

		const media = collectTweetMedia(payload);
		if (media.length === 0) return;

		const fetched = await Promise.all(media.map((item) => fetchTweetImage(item.url, ctx.signal)));
		const images: TextOrImage[] = [];
		const notes: string[] = [];
		for (const [index, item] of media.entries()) {
			const result = fetched[index];
			if (!result || "error" in result) {
				notes.push(`${item.label}: failed (${result && "error" in result ? result.error : "unknown"})`);
				continue;
			}
			images.push({ type: "image", data: result.data, mimeType: result.mimeType });
			notes.push(`${item.label}: ${result.width}×${result.height}`);
		}

		const existing = Array.isArray(event.content) ? (event.content as TextOrImage[]) : [];
		const note = `\n\n---\nTweet media: ${notes.join("; ")}`;
		const nextContent = [
			...images,
			...existing.map((block) =>
				block.type === "text" && typeof block.text === "string" ? { ...block, text: `${block.text}${note}` } : block,
			),
		];
		if (!nextContent.some((block) => block.type === "text")) {
			nextContent.push({ type: "text", text: note.trim() });
		}

		const details = asRecord(event.details) ?? {};
		return {
			content: nextContent,
			details: {
				...details,
				hasImage: images.length > 0,
				imageCount: images.length,
				twitterMedia: notes,
			},
		};
	});
}
