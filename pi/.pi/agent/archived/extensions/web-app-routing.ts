import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";

const APP_HOST_SUFFIXES = [".vercel.app", ".netlify.app", ".pages.dev"];
const APP_PATH_SEGMENTS = new Set(["admin", "app", "backoffice", "dashboard"]);

type FetchContentInput = {
	url?: unknown;
	urls?: unknown;
};

function isFetchContentInput(value: unknown): value is FetchContentInput {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function urlsFrom(input: FetchContentInput): string[] {
	const urls: string[] = [];
	if (typeof input.url === "string") urls.push(input.url);
	if (Array.isArray(input.urls)) {
		for (const url of input.urls) {
			if (typeof url === "string") urls.push(url);
		}
	}
	return urls;
}

function isLikelyWebApp(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		const hostname = url.hostname.toLowerCase();
		const firstPathSegment = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
		return hostname === "localhost"
			|| hostname === "127.0.0.1"
			|| APP_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
			|| (firstPathSegment !== undefined && APP_PATH_SEGMENTS.has(firstPathSegment));
	} catch {
		return false;
	}
}

function addRoutingGuidance(options: BuildSystemPromptOptions, systemPrompt: string): string {
	const hasBrowser = options.selectedTools?.includes("frontend_open") ?? false;
	if (!hasBrowser) return systemPrompt;

	return `${systemPrompt}

## URL routing

For an interactive web app (notably localhost, Vercel/Netlify/Cloudflare Pages, or an /admin, /app, /backoffice, or /dashboard route), use frontend_open first. It renders JavaScript and provides a screenshot and console health. Use fetch_content for documents, static HTML, raw endpoints, repositories, PDFs, and other server-readable content. Do not try fetch_content first on a likely web app.`;
}

export default function webAppRouting(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (event) => ({
		systemPrompt: addRoutingGuidance(event.systemPromptOptions, event.systemPrompt),
	}));

	pi.on("tool_call", (event) => {
		if (event.toolName !== "fetch_content" || !pi.getActiveTools().includes("frontend_open")) return;
		if (!isFetchContentInput(event.input)) return;
		if (!urlsFrom(event.input).some(isLikelyWebApp)) return;

		return {
			block: true,
			reason: "Likely JavaScript web app: use frontend_open first so the page is rendered before inspection.",
		};
	});
}
