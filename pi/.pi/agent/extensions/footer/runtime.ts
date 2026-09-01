import { buildFooterRenderInput } from './footer-input.ts'
import { fetchCurrentPr, fetchGitStatus } from './git-client.ts'
import { createPollingResource } from './polling-resource.ts'
import { pollQuotas } from './quota-client.ts'
import { clampFooterLines, renderFooterLines } from './render.ts'

import type { GitPr, GitStatus, QuotaCache } from './types.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
	Theme,
} from '@earendil-works/pi-coding-agent'
import type { TUI } from '@earendil-works/pi-tui'

const QUOTA_POLL_MS = 5 * 60 * 1_000
const GIT_POLL_MS = 4_000
const PR_POLL_MS = 30_000

export function registerFooterExtension(pi: ExtensionAPI): void {
	let enabled = true
	let footerInstalled = false
	let requestRender: (() => void) | undefined
	let currentCwd: string | undefined
	let quotas: QuotaCache = {}
	let git: GitStatus | null = null
	let pr: GitPr | null = null

	function requestRenderSafely(): void {
		try {
			requestRender?.()
		} catch {
			requestRender = undefined
		}
	}

	const quotaPolling = createPollingResource<void, QuotaCache>({
		intervalMs: QUOTA_POLL_MS,
		load: pollQuotas,
		onValue(value) {
			quotas = value
			requestRenderSafely()
		},
	})
	const gitPolling = createPollingResource<string, GitStatus | null>({
		intervalMs: GIT_POLL_MS,
		load: fetchGitStatus,
		onValue(value) {
			git = value
			requestRenderSafely()
		},
	})
	const prPolling = createPollingResource<string, GitPr | null>({
		intervalMs: PR_POLL_MS,
		load: fetchCurrentPr,
		onValue(value) {
			if (pr?.number === value?.number && pr?.url === value?.url) return
			pr = value
			requestRenderSafely()
		},
	})

	function setup(ctx: ExtensionContext): void {
		if (!enabled) return
		const cwd = ctx.cwd ?? process.cwd()
		currentCwd = cwd
		quotaPolling.start(undefined)
		gitPolling.start(cwd)
		prPolling.start(cwd)
		if (footerInstalled) {
			requestRenderSafely()
			return
		}
		footerInstalled = true
		ctx.ui.setFooter(
			(
				tui: TUI,
				_theme: Theme,
				footerData: ReadonlyFooterDataProvider,
			) => {
				requestRender = () => tui.requestRender()
				const unsubscribeBranch = footerData.onBranchChange(() => {
					pr = null
					tui.requestRender()
					if (currentCwd) void prPolling.refresh(currentCwd)
				})
				return {
					dispose() {
						unsubscribeBranch()
						footerInstalled = false
						requestRender = undefined
					},
					invalidate() {},
					render(width: number): string[] {
						try {
							const input = buildFooterRenderInput(
								width,
								ctx,
								footerData,
								{ git, pr, quotas },
							)
							return clampFooterLines(
								renderFooterLines(input),
								width,
							)
						} catch {
							return ['']
						}
					},
				}
			},
		)
	}

	function stopPolling(): void {
		quotaPolling.stop()
		gitPolling.stop()
		prPolling.stop()
		currentCwd = undefined
	}

	pi.on('session_start', async (_event, ctx) => setup(ctx))
	pi.on('session_shutdown', async () => {
		stopPolling()
		requestRender = undefined
		footerInstalled = false
	})
	pi.on('turn_end', async () => requestRenderSafely())
	pi.on('agent_end', async () => requestRenderSafely())
	pi.on('thinking_level_select', async () => requestRenderSafely())
	pi.on('model_select', async () => requestRenderSafely())

	pi.registerCommand('footer', {
		description: 'Toggle the Catppuccin footer',
		handler: async (_args, ctx) => {
			enabled = !enabled
			if (enabled) {
				footerInstalled = false
				setup(ctx)
				ctx.ui.notify('Footer enabled', 'info')
				return
			}
			ctx.ui.setFooter(undefined)
			stopPolling()
			footerInstalled = false
			requestRender = undefined
			ctx.ui.notify('Default footer restored', 'info')
		},
	})

	pi.registerCommand('latte-quota', {
		description: 'Force-refresh provider quota display',
		handler: async (_args, ctx) => {
			await quotaPolling.refresh()
			ctx.ui.notify('Quotas refreshed', 'info')
		},
	})
}
