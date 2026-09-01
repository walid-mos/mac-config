import { shortPath } from './format.ts'
import { finiteNumber, readSafely } from './value.ts'

import type {
	FooterRenderInput,
	GitPr,
	GitStatus,
	QuotaCache,
} from './types.ts'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import type {
	ExtensionContext,
	ReadonlyFooterDataProvider,
} from '@earendil-works/pi-coding-agent'

export type FooterDataSnapshot = {
	git: GitStatus | null
	pr: GitPr | null
	quotas: QuotaCache
}

export function buildFooterRenderInput(
	width: number,
	ctx: ExtensionContext,
	footerData: ReadonlyFooterDataProvider,
	data: FooterDataSnapshot,
): FooterRenderInput {
	return {
		width,
		model: readSafely(() => ctx.model?.id, undefined) || 'no-model',
		thinkingLevel: readSafely(() => ctx.thinkingLevel, 'off') ?? 'off',
		cwd: shortPath(readSafely(() => ctx.cwd, undefined) ?? process.cwd()),
		branch: footerData.getGitBranch() || undefined,
		usage: readSafely(() => ctx.getContextUsage?.(), undefined),
		tokens: sumAssistantUsage(ctx),
		statuses: [...footerData.getExtensionStatuses().values()].filter(
			Boolean,
		),
		git: data.git,
		pr: data.pr,
		quotas: data.quotas,
		provider: readSafely(
			() => ctx.model?.provider,
			undefined,
		)?.toLowerCase(),
	}
}

function sumAssistantUsage(ctx: ExtensionContext): FooterRenderInput['tokens'] {
	const totals = { input: 0, output: 0, cost: 0 }
	for (const entry of readSafely(() => ctx.sessionManager.getBranch(), [])) {
		if (entry.type !== 'message' || entry.message.role !== 'assistant')
			continue
		const message = entry.message as AssistantMessage
		totals.input += finiteNumber(message.usage?.input) ?? 0
		totals.output += finiteNumber(message.usage?.output) ?? 0
		totals.cost += finiteNumber(message.usage?.cost?.total) ?? 0
	}
	return totals
}
