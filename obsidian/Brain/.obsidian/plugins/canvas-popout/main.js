/* Canvas Popout — clic simple sur un EMBED de canvas (![[x.canvas]]) :
 * ouverture en fenêtre flottante (popout) au lieu de naviguer.
 * Un drag (pan/zoom dans l'aperçu) et les clics modifiés gardent le
 * comportement natif ; les liens [[x.canvas]] ne sont pas touchés. */
const { Plugin } = require('obsidian')

const DRAG_TOLERANCE_PX = 5

module.exports = class CanvasPopout extends Plugin {
	onload() {
		let downX = 0
		let downY = 0

		this.registerDomEvent(
			document,
			'pointerdown',
			evt => {
				downX = evt.clientX
				downY = evt.clientY
			},
			true
		)

		this.registerDomEvent(
			document,
			'click',
			evt => {
				if (evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.altKey || evt.shiftKey) return
				if (!(evt.target instanceof Element)) return
				const embedEl = evt.target.closest('.internal-embed.canvas-embed')
				if (!embedEl) return
				if (Math.hypot(evt.clientX - downX, evt.clientY - downY) > DRAG_TOLERANCE_PX) return
				const src = embedEl.getAttribute('src')
				if (!src) return
				const sourcePath = this.app.workspace.getActiveFile()?.path ?? ''
				const file = this.app.metadataCache.getFirstLinkpathDest(src, sourcePath)
				if (!file || file.extension !== 'canvas') return
				evt.preventDefault()
				evt.stopPropagation()
				this.app.workspace
					.openPopoutLeaf({ size: { width: 1440, height: 900 } })
					.openFile(file)
			},
			true
		)
	}
}
