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

// Notificateur prioritaire : bundle /Applications/Pi.app (copie signée par la
// cible Makefile `notifier-app` du bundle brew terminal-notifier, icône
// Ghostty, bundle id app.pi.notifier). Un binaire hors bundle est livré mais
// jamais affiché : macOS exige un .app registré pour lever une bannière.
const NOTIFIER = [
  "/Applications/Pi.app/Contents/MacOS/terminal-notifier",
  "/opt/homebrew/bin/terminal-notifier",
].find((candidate) => existsSync(candidate));
const HERDR = "/opt/homebrew/bin/herdr";
const PANE_ID = process.env.HERDR_PANE_ID;

function enabled(): boolean {
  return process.env.HERDR_ENV === "1" && !!PANE_ID && !!NOTIFIER;
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
  return [
    "open -ga Ghostty",
    "sleep 0.2",
    `${HERDR} pane focus --direction up --pane ${PANE_ID}`,
  ].join("; ");
}

function showNotification(title: string, message: string): void {
  spawn(
    NOTIFIER,
    [
      "-title", title,
      "-subtitle", `pane ${PANE_ID}`,
      "-message", message,
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
