# working-loader — loader `sand` à mots rotatifs

Remplace le "Thinking..." persistant du transcript par une ligne loader qui
anime le spinner `sand` toutes les 80 ms et fait tourner des mots (sérieux et
absurdes) toutes les 4 secondes tant que l'agent travaille :

```
⠁ Pondering...
⠂ Sloubagoubliming...
⠄ Brewing...
⡀ Pondering...
```

## Intégration

- La ligne est rendue **via le registre surface** (`../ui/surface.ts`) avec la
  priorité `ABOVE_EDITOR_PRIORITY.working` (50, donc collée au prompt).
- Chaque frame ou changement de mot ré-enregistre la même entrée
  (`working-loader`) : overwrite + notification → un seul re-render par tick.
- Pendant que la ligne est affichée, le spinner natif est masqué
  (`setWorkingVisible(false)`) puis rétabli — une seule ligne loader à l'écran.

## Modules

- `index.ts` — point d'entrée : événements `agent_start` / `agent_end`,
  pause pendant `ask_user_question` (le questionnaire attend l'utilisateur,
  un loader rotatif y serait trompeur), nettoyage au `session_shutdown`.
- `rotation.ts` — timer injectable (testable) ; `start()` idempotent.
- `spinner.ts` — les 35 frames canoniques de `sand` et leur rotation à 80 ms.
- `shuffle-bag.ts` — sac brassé Fisher-Yates sans répétition dans un cycle ni
  répétition du dernier mot d'un cycle au début du suivant ; buffer réutilisé,
  zéro allocation en régime permanent.
- `words.ts` — vocabulaire.

## Notes

- `setHiddenThinkingLabel("")` est posé au `session_start` (donc re-posé après
  `/reload`, qui réinitialise l'UI) et restauré au `session_shutdown`.
- RPC / modes sans TUI : toutes les méthodes UI utilisées sont des no-ops
  côté hôte, l'extension dégrade proprement.
