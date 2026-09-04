# Activity strip

Timeline minimale du traitement courant, juste sous le loader/thinking :

`  ◴ 00:42  ─────━━─────────                  12k input · ~3.4k output · 8.1k cache · 81 tok/s`

- l’horloge tourne et la tête de lecture glisse quatre fois par seconde sur une
  piste plafonnée à 24 colonnes ; le reste de la largeur demeure vide ;
- le temps mesure la demande courante, sans libellé abstrait `PROMPT` ;
- l’output précédé de `~` progresse pendant le streaming à partir des deltas ;
  il est remplacé par l’usage exact du provider à chaque fin de tour ;
- input, output et cache concernent cette demande uniquement ; le débit final
  divise l’output exact par le temps cumulé où le modèle a réellement streamé,
  hors outils et attentes — jamais par la durée globale de session ;
- une fois terminé, l’horloge devient `✓`, la timeline se fige et reste visible
  vingt secondes ;
- le rendu n’utilise que `muted`/`dim` et compacte les tokens avant de retirer
  les détails sur terminal étroit ;
- `thinking: 0` et `sessionStatus: 10` restent les deux premières surfaces, dans
  cet ordre.
