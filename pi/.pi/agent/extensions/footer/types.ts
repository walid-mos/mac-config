export type KimiQuota = {
	fiveHour: { used: number; limit: number; remaining: number; reset: string }
	weekly: { used: number; limit: number; remaining: number; reset: string }
}

export type OpenRouterQuota = {
	balance: number
	weekly?: { remaining: number; limit: number; reset?: string }
}

export type XaiQuota = {
	tier?: string
	monthly?: { used: number; limit: number; reset: string }
	pool?: { usedPercent: number; reset: string; label: 'hebdo' | 'mois' }
	prepaidBalance?: number
}

export type UsageWindow = {
	usedPercent: number
	reset: string
	label: string
}

export type OpenAIQuota = {
	plan?: string
	windows: UsageWindow[]
	credits?: number
	resets?: number
}

export type QuotaCache = {
	kimi?: KimiQuota
	openrouter?: OpenRouterQuota
	xai?: XaiQuota
	openai?: OpenAIQuota
	error?: boolean
}

export type GitStatus = {
	modified: number
	staged: number
	deleted: number
	untracked: number
	stash: number
	ahead: number
	behind: number
}

export type GitPr = { number: number; url: string }

export type FooterUsage = {
	percent: number
	tokens?: number
	contextWindow?: number
}

export type FooterRenderInput = {
	width: number
	model: string
	thinkingLevel: string
	cwd: string
	branch?: string
	usage?: FooterUsage
	tokens: { input: number; output: number; cost: number }
	statuses: readonly string[]
	git: GitStatus | null
	pr: GitPr | null
	quotas: QuotaCache
	provider?: string
}
