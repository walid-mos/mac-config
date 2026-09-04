# working-loader — loader `sand` à mots rotatifs

Ajoute une ligne loader qui anime le spinner `sand` toutes les 80 ms et fait
tourner des mots (sérieux et absurdes) toutes les 4 secondes tant que l'agent
travaille, sans modifier le rendu natif du thinking dans le transcript :

```
⠁ Pondering...
⠂ Pondering...                 󰧑 vérifie les événements du stream…
⠄ Pondering...                 󰧑 …puis recalcule la largeur disponible
⡀ Pondering...
```

## Intégration

- La ligne est rendue **via le registre surface** (`../ui/surface.ts`) avec la
  priorité réservée `ABOVE_EDITOR_PRIORITY.thinking` (0), tout en haut de la pile.
- Le spinner `sand` et les spinners des jobs Background commencent tous en
  colonne 0, avec leur libellé en colonne 2 ; seuls les enfants d'un groupe
  Background restent indentés.
- Pendant un stream de reasoning, `nf-md-brain` (`U+F09D1`) précède à droite
  un aperçu roulant des derniers `thinking_delta`. Sa région cible occupe la
  moitié droite du terminal, avec un minimum de 32 colonnes ; elle disparaît
  plutôt que d'être davantage compressée quand l'espace manque.
- Les deltas sont accumulés en continu, mais l'aperçu roule sur le dernier bloc
  reçu au lieu d'additionner les summaries précédents. Aucun placeholder
  `raisonnement` n'est affiché : le premier snapshot utile paraît après 800 ms,
  puis reste stable et se renouvelle au plus toutes les 2,5 secondes. Une sortie
  différée absorbe les transitions `think → work → think` brèves ; le dernier
  extrait reste lisible avant de disparaître.
- Chaque frame ou changement de mot ré-enregistre la même entrée
  (`working-loader`) : overwrite + notification → un seul re-render par tick.
  Le tick `sand` fait aussi avancer la timeline, sans timer ni widget TUI
  supplémentaire.
- Pendant que la ligne est affichée, le spinner natif est masqué
  (`setWorkingVisible(false)`) puis rétabli — une seule ligne loader à l'écran.

## Modules

- `index.ts` — point d'entrée : événements `agent_start` / `agent_settled`,
  pause pendant `ask_user_question` (le questionnaire attend l'utilisateur,
  un loader rotatif y serait trompeur), nettoyage au `session_shutdown`.
- `rotation.ts` — timer injectable (testable) ; `start()` idempotent.
- `spinner.ts` — les 35 frames canoniques de `sand` et leur rotation à 80 ms.
- `thinking-preview.ts` — buffer borné, snapshots temporisés, grâce anti-flicker,
  calcul de la région droite et fenêtre de fin Unicode à largeur terminale.
- `shuffle-bag.ts` — sac brassé Fisher-Yates sans répétition dans un cycle ni
  répétition du dernier mot d'un cycle au début du suivant ; buffer réutilisé,
  zéro allocation en régime permanent.
- `words.ts` — vocabulaire.

## Notes

- Le loader ne touche ni `hideThinkingBlock`, ni `setHiddenThinkingLabel` : le
  raccourci natif de Pi reste seul propriétaire du transcript de reasoning.
- RPC / modes sans TUI : toutes les méthodes UI utilisées sont des no-ops
  côté hôte, l'extension dégrade proprement.
