// Notifications desktop propres pour Pi sous Herdr.
//
// Herdr continue de remonter l'état des agents pour les panes, mais ses toasts
// sont coupés. Cette extension est l'unique canal desktop : fin de tâche et
// décision requise, avec clic vers la pane Herdr émettrice.
//
// Best-effort absolu : aucune erreur de notification ne doit remonter dans Pi.

import { createPiNotifyExtension } from './pi-notify/extension.ts'

export {
	createPiNotifyExtension,
	extractFinalSnippet,
} from './pi-notify/extension.ts'
export { createFocusProbe } from './pi-notify/focus.ts'
export {
	NotificationPoster,
	notificationEnabled,
	type NotificationEnvironment,
} from './pi-notify/poster.ts'
export type {
	ChildProcessLike,
	NotificationOperations,
} from './pi-notify/process.ts'

export default createPiNotifyExtension()
