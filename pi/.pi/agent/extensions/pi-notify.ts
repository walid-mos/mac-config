// Notifications desktop propres pour Pi sous Herdr.
//
// Problème historique : herdr (delivery = "system") retombait sur
// `osascript display notification` faute de terminal-notifier dans le PATH
// GUI → notifications attribuées à « Script Editor », clic infonctionnel.
//
// Fonctionnement (travail de concert avec la couche Herdr) :
// - l'intégration officielle herdr (herdr-agent-state.ts) remonte déjà
//   working/blocked/idle au serveur herdr, qui affiche des toasts in-app ;
// - cette extension ajoute la couche desktop, pane-scoped : au moment où Pi
//   se stabilise (fin de tâche) ou demande une décision, elle émet une
//   notification via terminal-notifier (notification macOS native) et surtout
//   `-execute` : au clic → activation de Ghostty + `herdr pane focus`
//   sur LA pane qui a émis la notification (HERDR_PANE_ID).
//   NB : pas de `-sender com.mitchellh.ghostty` — charger le bundle Ghostty
//   fait hanguer terminal-notifier et la notification n'apparaît jamais.
//
// Best-effort absolu : aucune erreur ne doit remonter dans le cycle de Pi.

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Poster prioritaire : le helper résident /Applications/Pi.app (construit par
// `make notifier-app`, source scripts/notifier/pi-notify.swift). Il poste la
// notification et gère lui-même le clic (activation Ghostty + focus pane) :
// terminal-notifier, lui, dépend d'un relaunch qui perd la réponse du clic.
// Repli : binaire brew terminal-notifier avec -execute (best-effort).
const HELPER = "/Applications/Pi.app/Contents/MacOS/pi-notify";
const NOTIFIER = "/opt/homebrew/bin/terminal-notifier";
const HERDR = "/opt/homebrew/bin/herdr";
const SOCKET = process.env.HERDR_SOCKET_PATH;
const PANE_ID = process.env.HERDR_PANE_ID;

function enabled(): boolean {
  return process.env.HERDR_ENV === "1" && !!PANE_ID && !!SOCKET
    && (existsSync(HELPER) || existsSync(NOTIFIER));
}

function ghosttyFrontmost(): Promise<boolean> {
  // Silencieux : seulement un sondage d'état, jamais de notification.
  // En cas d'échec (timeout, binaire absent) on notifie quand même.
  return new Promise((resolve) => {
    execFile(
      "/usr/bin/osascript",
      ['-e', 'application "Ghostty" is frontmost'],
      { timeout: 750 },
      (error, stdout) => {
        resolve(!error && String(stdout).trim() === "true");
      },
    );
  });
}

function focusThisPaneOnWatch(): string {
  // Au clic, terminal-notifier est relancé par LaunchServices dans un contexte
  // GUI sans nos variables : sans HERDR_SOCKET_PATH, `herdr` cherche son socket
  // dans $TMPDIR/herdr et le focus rate silencieusement. On embarque donc le
  // chemin du socket (lu à l'émission) dans la commande elle-même.
  return [
    "open -a Ghostty",
    "sleep 0.2",
    `HERDR_SOCKET_PATH='${SOCKET}' ${HERDR} agent focus ${PANE_ID}`,
  ].join("; ");
}

function showNotification(title: string, message: string): void {
  const common = ["-title", title, "-subtitle", `pane ${PANE_ID}`, "-message", message];
  if (existsSync(HELPER)) {
    // Helper lancé PAR LaunchServices (check-in obligatoire pour que usernoted
    // route la réponse du clic vers l'instance résidente) — un exec direct du
    // binaire ne suffit pas. -n force une nouvelle instance : sans lui, une
    // registration LS fantôme (après kill d'une instance) ferait échouer le
    // open silencieusement. Le pkill préalable évite le cumul d'instances
    // résidentes du même pane.
    spawn("pkill", ["-f", `MacOS/pi-notify .*-pane ${PANE_ID}( |$)`], { stdio: "ignore" })
      .unref?.();
    spawn(
      "/usr/bin/open",
      ["-n", "/Applications/Pi.app", "--args", ...common, "-pane", PANE_ID!, "-socket", SOCKET!, "-timeout", "90"],
      { detached: true, stdio: "ignore" },
    ).unref?.();
    return;
  }
  spawn(
    NOTIFIER,
    [
      ...common,
      "-group", `pi-${PANE_ID}`,
      "-execute", focusThisPaneOnWatch(),
    ],
    { detached: true, stdio: "ignore" },
  ).unref?.();
}

async function notify(title: string, message: string): Promise<void> {
  try {
    if (await ghosttyFrontmost()) {
      // L'utilisateur regarde déjà herdr : toast in-app + son suffisent.
      return;
    }
    showNotification(title, message);
  } catch {
    // Best-effort : silencieux.
  }
}

export default function (pi: any) {
  if (!enabled()) {
    return;
  }

  let running = false;
  let blockedSeen = false;
  let lastSnippet = "";

  function cwdName(ctx: any): string {
    const cwd = typeof ctx?.cwd === "string" && ctx.cwd ? ctx.cwd : process.cwd();
    return path.basename(cwd);
  }

  // Dernier texte assistant = contenu informatif de la notification « Terminé ».
  pi.on("message_end", (event: any) => {
    const message = event?.message;
    if (message?.role !== "assistant") {
      return;
    }
    const text = (Array.isArray(message.content) ? message.content : [])
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    if (text) {
      lastSnippet = text.slice(0, 160);
    }
  });

  pi.on("agent_start", (_event: any, ctx: any) => {
    if (ctx?.mode !== "tui") {
      return;
    }
    running = true;
    lastSnippet = "";
  });

  pi.on("agent_settled", async (_event: any, ctx: any) => {
    if (ctx?.mode !== "tui" || ctx?.isIdle?.() !== true || !running) {
      return;
    }
    running = false;
    await notify(`Pi · ${cwdName(ctx)} — terminé`, lastSnippet || "Prêt pour la suite");
  });

  // Pi attend un choix utilisateur (ask_user_question) : l'agent est toujours
  // « running », agent_settled ne tirera pas → il faut notifier ici.
  pi.on("tool_execution_start", (event: any, ctx: any) => {
    if (ctx?.mode !== "tui" || event?.toolName !== "ask_user_question") {
      return;
    }
    void notify(`Pi · ${cwdName(ctx)} — décision requise`, "Une question attend ton choix");
  });

  // Événement de la couche herdr (sessions Pi) : agent bloqué.
  pi.events.on("herdr:blocked", (data: any) => {
    if (data?.active) {
      if (blockedSeen) {
        return;
      }
      blockedSeen = true;
      void notify("Pi — attention requise", String(data.label ?? "Blocage détecté"));
    } else {
      blockedSeen = false;
    }
  });
}
