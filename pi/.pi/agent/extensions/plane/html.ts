/** Convert ticket/comment source to the HTML Plane actually renders. */

const ALREADY_HTML = /^\s*</;

export function toDescriptionHtml(source: string): string {
	const trimmed = source.trim();
	if (trimmed.length === 0) return "<div></div>";
	if (ALREADY_HTML.test(trimmed)) {
		return trimmed.startsWith("<div") ? trimmed : `<div>${trimmed}</div>`;
	}
	return `<div>${markdownToHtml(trimmed)}</div>`;
}

export function toCommentHtml(source: string): string {
	const trimmed = source.trim();
	if (trimmed.length === 0) return "<p></p>";
	if (ALREADY_HTML.test(trimmed)) return trimmed;
	return `<p>${escapeHtml(trimmed).replaceAll("\n", "<br/>")}</p>`;
}

function markdownToHtml(source: string): string {
	const blocks: string[] = [];
	let listItems: string[] = [];

	const flushList = (): void => {
		if (listItems.length === 0) return;
		blocks.push(`<ul>${listItems.join("")}</ul>`);
		listItems = [];
	};

	for (const line of source.split("\n")) {
		const heading = /^(#{1,6})\s+(.+)$/.exec(line);
		const marks = heading?.[1];
		const title = heading?.[2];
		if (marks && title) {
			flushList();
			const level = Math.min(marks.length, 6);
			blocks.push(`<h${level}>${inline(title)}</h${level}>`);
			continue;
		}
		const item = /^[-*]\s+(.+)$/.exec(line)?.[1];
		if (item) {
			listItems.push(`<li>${inline(item)}</li>`);
			continue;
		}
		if (line.trim() === "") {
			flushList();
			continue;
		}
		flushList();
		blocks.push(`<p>${inline(line)}</p>`);
	}
	flushList();
	return blocks.join("");
}

function inline(text: string): string {
	return escapeHtml(text)
		.replaceAll(/`([^`]+)`/g, "<code>$1</code>")
		.replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
