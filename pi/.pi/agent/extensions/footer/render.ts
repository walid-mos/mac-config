import { terminalLineWidth, truncateTerminalLine } from "../ui/terminal-text.ts";
import { compactPath, fmtTokens } from "./format.ts";
import { gitWithPr } from "./git-render.ts";
import { providerQuotaParts, quotaContent } from "./quota-render.ts";
import { BAR_EMPTY, BAR_FULL, BAR_WIDTH, ICONS, LATTE, SEP_THIN, THINKING_COLORS, fgHex, thinSep } from "./style.ts";
import type { FooterRenderInput, FooterUsage } from "./types.ts";

export function clampFooterLines(lines: string[], width: number): string[] {
	return lines.map((line) => truncateTerminalLine(line, width));
}

/** Line 2 left: branch │ slim churn bar + counters (+ PR link appended later). */
function justifyLine(left: string, right: string, width: number): string {
	const pad = " ".repeat(Math.max(1, width - terminalLineWidth(left) - terminalLineWidth(right)));
	return truncateTerminalLine(left + pad + right, width);
}

/** Quiet flat metadata: colored icon + muted label. */
function meta(icon: string, iconColor: string, label: string): string {
	return `${fgHex(iconColor, icon)} ${fgHex(LATTE.subtext0, label)}`;
}

function contextGroup(usage: FooterUsage, exactTokens: boolean): string {
	const pct = Math.round(usage.percent);
	const filled = Math.round((usage.percent / 100) * BAR_WIDTH);
	const barColor =
		usage.percent < 50 ? LATTE.green : usage.percent < 80 ? LATTE.peach : LATTE.red;
	const bar =
		fgHex(barColor, BAR_FULL.repeat(filled)) +
		fgHex(LATTE.surface1, BAR_EMPTY.repeat(BAR_WIDTH - filled));
	const exact =
		exactTokens && usage.tokens != null && usage.contextWindow != null
			? ` ${fgHex(LATTE.subtext0, `${fmtTokens(usage.tokens)}/${fmtTokens(usage.contextWindow)}`)}`
			: "";
	return `${fgHex(LATTE.subtext0, ICONS.context)} ${bar} ${fgHex(barColor, `${pct}%`)}${exact}`;
}

export function renderFooterLines(input: FooterRenderInput): string[] {
	const width = Math.max(0, input.width);

	// ── Line 1 left: hero pill (model + thinking), never degraded ──
	const modelGroup = [
		`${fgHex(LATTE.mauve, ICONS.model)} ${fgHex(LATTE.text, input.model)}`,
		fgHex(THINKING_COLORS[input.thinkingLevel] ?? LATTE.subtext0, `${ICONS.thinking} ${input.thinkingLevel}`),
	].join(` ${fgHex(LATTE.mauve, SEP_THIN)} `);

	const arrowsGroup = fgHex(
		LATTE.subtext0,
		`\u2191${fmtTokens(input.tokens.input)} \u2193${fmtTokens(input.tokens.output)}`,
	);
	const costGroup = fgHex(LATTE.text, `$${input.tokens.cost.toFixed(3)}`);

	type Variant = { pathMax: number; exactTokens: boolean; hideMeta?: boolean };
	// Progressive degradation: shrink quiet meta first, then drop exact tokens,
	// then hide the meta block entirely, finally drop the arrow token counts
	// (the hero pill, context gauge and cost are never dropped).
	const variants: Variant[] = [
		{ pathMax: 34, exactTokens: true },
		{ pathMax: 22, exactTokens: true },
		{ pathMax: 18, exactTokens: false },
		{ pathMax: 18, exactTokens: false, hideMeta: true },
	];

	const buildLeft = (v: Variant): string => {
		let left = modelGroup;
		if (!v.hideMeta) {
			left = `${modelGroup} ${thinSep()} ${meta(ICONS.folder, LATTE.teal, compactPath(input.cwd, v.pathMax))}`;
		}
		return left;
	};
	// ── Line 1 right: provider quotas — model usage lives with the model ──
	const quotaOf = (compact: boolean): string =>
		quotaContent(providerQuotaParts(input.quotas, input.provider, compact));
	let line1: string | undefined;
	for (const v of variants) {
		const left = buildLeft(v);
		const right = quotaOf(false);
		if (terminalLineWidth(left) + terminalLineWidth(right) + 2 <= width) {
			line1 = justifyLine(left, right, width);
			break;
		}
	}
	if (line1 === undefined) {
		const left = buildLeft(variants[variants.length - 1]!);
		const compactQuota = quotaOf(true);
		line1 =
			terminalLineWidth(left) + terminalLineWidth(compactQuota) + 2 <= width
				? justifyLine(left, compactQuota, width)
				: truncateTerminalLine(justifyLine(left, compactQuota, width), width);
	}
	// ── Line 2: git left │ statuses + context + arrows + cost right ──
	const dataRight = (exactTokens: boolean, withArrows: boolean): string => {
		const rightGroups: string[] = [];
		if (input.statuses.length > 0) {
			rightGroups.push(input.statuses.join("  "));
		}
		if (input.usage != null && Number.isFinite(input.usage.percent)) {
			rightGroups.push(contextGroup(input.usage, exactTokens));
		}
		if (withArrows) rightGroups.push(arrowsGroup);
		rightGroups.push(costGroup);
		return rightGroups.join(` ${thinSep()} `);
	};
	// Degradation ladder: keep the richest right side as long as some left
	// variant fits — the cost is the very last thing either side gives up.
	const rights: string[] = [
		dataRight(true, true),
		dataRight(false, true),
		dataRight(false, false),
		costGroup,
	];
	const lefts: string[] = [
		gitWithPr(input.git, input.pr, input.branch),
		gitWithPr(input.git, input.pr, input.branch, 28, false),
		gitWithPr(input.git, input.pr, input.branch, 10, false),
		gitWithPr(input.git, input.pr, input.branch, 8, false),
		gitWithPr(input.git, input.pr, undefined, 28, false),
	];
	let line2: string | undefined;
	for (const right of rights) {
		for (const left of lefts) {
			if (terminalLineWidth(left) + terminalLineWidth(right) + 2 <= width) {
				line2 = justifyLine(left, right, width);
				break;
			}
		}
		if (line2 !== undefined) break;
	}
	line2 ??= truncateTerminalLine(justifyLine(lefts[0]!, costGroup, width), width);
	return [line1, line2];
}
