// pi-notify — poster de notifications desktop résident pour Pi sous Herdr.
//
// Pourquoi pas terminal-notifier ? Son `-execute` au clic dépend du relaunch
// de l'app par usernoted ; relancée sans arguments, l'instance n'installe
// jamais son delegate et la réponse du clic est perdue (observé sur macOS 27 :
// log usernoted « Launching … for legacy response » sans exécution).
//
// Contraintes que ce helper respecte, apprises à l'inverse :
// - être lancé PAR LaunchServices (`open -a Pi --args …`) : un exec direct du
//   binaire ne fait pas de check-in launchservicesd et usernoted ne route pas
//   la réponse du clic vers l'instance vivante — il relance une instance vide ;
// - avoir un cycle de vie NSApplication complet (`app.run()`) : sans ça,
//   l'app n'est jamais « active », pas de bannière (willPresent ignoré) et la
//   notification tombe directement dans la liste du centre ;
// - rester résident jusqu'au clic ou à la fermeture explicite : c'est lui qui
//   exécute l'action, sans expiration qui casserait les clics tardifs.
//
// Au clic : focus de la pane puis activation de Ghostty :
//   HERDR_SOCKET_PATH=<socket> herdr agent focus <pane>
// (socket lu à l'émission : le contexte GUI du clic n'a pas les variables
// herdr et le CLI chercherait son socket dans $TMPDIR/herdr).
//
// Usage : open -a Pi --args -title T [-subtitle S] [-message M]
//                -pane ID -socket PATH
// Erreurs : terminaison silencieuse (best-effort par contrat).

import AppKit
import UserNotifications

final class Handler: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    var pane = ""
    var socket = ""
    var handled = false
    var debugEnabled = false

    func debug(_ message: String) {
        guard debugEnabled else { return }
        let stamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        NSLog("pi-notify[pid %@] %@", String(ProcessInfo.processInfo.processIdentifier), "\(stamp) \(message)")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let argv = ProcessInfo.processInfo.arguments
        func arg(_ name: String) -> String? {
            guard let i = argv.firstIndex(of: name), i + 1 < argv.count else { return nil }
            return argv[i + 1]
        }
        debugEnabled = argv.contains("-debug")
        debug("didFinishLaunching argv=\(argv.joined(separator: " | "))")
        guard let pane = arg("-pane"), let socket = arg("-socket") else {
            debug("ERREUR : -pane/-socket manquants")
            NSApp.terminate(nil)
            return
        }
        self.pane = pane
        self.socket = socket
        let title = arg("-title") ?? "Pi"
        let subtitle = arg("-subtitle")
        let message = arg("-message") ?? ""

        let content = UNMutableNotificationContent()
        content.title = title
        if let subtitle = subtitle {
            content.subtitle = subtitle
        }
        content.body = message
        content.threadIdentifier = "pi-\(pane)"
        content.categoryIdentifier = "pi-notification"
        // Cette notification est l'unique alerte, dans Ghostty comme ailleurs.
        // Le mode Concentration garde le dernier mot sur sa présentation.
        content.sound = UNNotificationSound.default

        // Identifiant stable par pane : une nouvelle notification remplace la
        // précédente (équivalent de -group chez terminal-notifier).
        let request = UNNotificationRequest(identifier: "pi-\(pane)", content: content, trigger: nil)

        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: "pi-notification",
                actions: [],
                intentIdentifiers: [],
                options: [.customDismissAction]
            )
        ])
        center.requestAuthorization(options: [.alert, .sound]) { [weak self] granted, error in
            self?.debug("requestAuthorization granted=\(granted) error=\(String(describing: error))")
            guard granted else {
                DispatchQueue.main.async { self?.finish() }
                return
            }
            center.add(request) { [weak self] addError in
                self?.debug("add() error=\(String(describing: addError))")
                guard addError != nil else { return }
                DispatchQueue.main.async { self?.finish() }
            }
        }
    }

    // `handled` n'est consulté et muté que sur le thread principal. Les
    // callbacks UserNotifications pouvant arriver hors de ce thread, tous les
    // chemins de terminaison y convergent avant d'arbitrer clic/erreur/refus.
    func finish() {
        dispatchPrecondition(condition: .onQueue(.main))
        guard !handled else { return }
        debug("finish (refus, erreur ou fermeture)")
        handled = true
        NSApp.terminate(nil)
    }

    // L'app est active au moment de la livraison : il faut réclamer la
    // bannière explicitement, sinon la notification ne va que dans la liste.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        debug("willPresent (bannière réclamée)")
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        DispatchQueue.main.async { [weak self] in
            self?.handle(response, completionHandler: completionHandler)
                ?? completionHandler()
        }
    }

    private func handle(
        _ response: UNNotificationResponse,
        completionHandler: @escaping () -> Void
    ) {
        dispatchPrecondition(condition: .onQueue(.main))
        debug("didReceive action=\(response.actionIdentifier)")
        guard !handled else {
            completionHandler()
            return
        }
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else {
            completionHandler()
            finish()
            return
        }
        handled = true

        func run(_ path: String, _ arguments: [String], environment: [String: String]) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: path)
            process.arguments = arguments
            process.environment = environment
            do {
                try process.run()
                process.waitUntilExit()
                debug("run \(path) args=\(arguments.joined(separator: " ")) → exit \(process.terminationStatus)")
            } catch {
                debug("run \(path) ÉCHEC : \(error)")
            }
        }

        // Hors du thread principal : waitUntilExit() bloquerait l'app.
        DispatchQueue.global().async { [weak self] in
            let env = ProcessInfo.processInfo.environment

            // 1. Focus de la pane émettrice d'abord : c'est un état serveur
            //    herdr (~10 ms), indépendant du GUI. Le TUI affichera la bonne
            //    pane dès que Ghostty remontera. Socket embarqué à l'émission :
            //    le contexte GUI du clic n'a pas les variables herdr et le CLI
            //    chercherait son socket dans $TMPDIR/herdr.
            var herdrEnv = env
            herdrEnv["HERDR_SOCKET_PATH"] = self?.socket
            run("/opt/homebrew/bin/herdr",
                ["agent", "focus", self?.pane ?? ""],
                environment: herdrEnv)

            // 2. Ghostty au premier plan. « -a » seul : PAS de -g (arrière-plan),
            //    première cause de « le clic ne ramène pas ».
            run("/usr/bin/open", ["-a", "Ghostty"], environment: env)

            completionHandler()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self?.debug("terminé après clic")
                NSApp.terminate(nil)
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // ni Dock ni switcher
let delegate = Handler()
app.delegate = delegate
if ProcessInfo.processInfo.arguments.contains("-debug") {
    NSLog("pi-notify: top-level atteint, activationPolicy=%@, app.run()…",
          String(describing: app.activationPolicy()))
}
app.run()
if ProcessInfo.processInfo.arguments.contains("-debug") {
    NSLog("pi-notify: app.run() terminé (exit imminent)")
}
