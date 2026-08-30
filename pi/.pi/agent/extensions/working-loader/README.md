# working-loader — loader `sand` à mots rotatifs

Remplace le "Thinking..." persistant du transcript par une ligne loader qui
anime le spinner `sand` toutes les 80 ms et fait tourner des mots (sérieux et
absurdes) toutes les 4 secondes tant que l'agent travaille :

```
⠁ Pondering...
⠂ Pondering...                 󰧑 vérifie les événements du stream…
⠄ Pondering...                 󰧑 …puis recalcule la largeur disponible
⡀ Pondering...
```

## Intégration

- La ligne est rendue **via le registre surface** (`../ui/surface.ts`) avec la
  priorité `ABOVE_EDITOR_PRIORITY.working` (50, donc collée au prompt).
- Le spinner `sand` et les spinners des jobs Background commencent tous en
  colonne 0, avec leur libellé en colonne 2 ; seuls les enfants d'un groupe
  Background restent indentés.
- Pendant un stream de reasoning, `nf-md-brain` (`U+F09D1`) précède à droite
  un aperçu roulant des derniers `thinking_delta`. L'extrait est nettoyé,
  plafonné à 48 colonnes, éphémère et remplacé par `raisonnement` avant le
  premier delta ; il disparaît si la largeur est insuffisante.
- Chaque frame ou changement de mot ré-enregistre la même entrée
  (`working-loader`) : overwrite + notification → un seul re-render par tick.
  Le tick `sand` cadence aussi l'aperçu, sans timer ni widget TUI supplémentaire.
- Pendant que la ligne est affichée, le spinner natif est masqué
  (`setWorkingVisible(false)`) puis rétabli — une seule ligne loader à l'écran.

## Modules

- `index.ts` — point d'entrée : événements `agent_start` / `agent_end`,
  pause pendant `ask_user_question` (le questionnaire attend l'utilisateur,
  un loader rotatif y serait trompeur), nettoyage au `session_shutdown`.
- `rotation.ts` — timer injectable (testable) ; `start()` idempotent.
- `spinner.ts` — les 35 frames canoniques de `sand` et leur rotation à 80 ms.
- `thinking-preview.ts` — buffer borné, nettoyage terminal/Markdown et fenêtre
  de fin Unicode à largeur terminale.
- `shuffle-bag.ts` — sac brassé Fisher-Yates sans répétition dans un cycle ni
  répétition du dernier mot d'un cycle au début du suivant ; buffer réutilisé,
  zéro allocation en régime permanent.
- `words.ts` — vocabulaire.

## Notes

- `setHiddenThinkingLabel("")` est posé au `session_start` (donc re-posé après
  `/reload`, qui réinitialise l'UI) et restauré au `session_shutdown`.
- RPC / modes sans TUI : toutes les méthodes UI utilisées sont des no-ops
  côté hôte, l'extension dégrade proprement.
