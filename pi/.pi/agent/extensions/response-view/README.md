# response-view — hiérarchie visuelle des réponses

Donne au Markdown produit par l'assistant une surface de lecture immédiatement
repérable sans l'enfermer dans une carte. Un diamant creux en filigrane ouvre
la réponse et lance un trait accentué ; aucun rail inférieur ne referme le
contenu. Le corps reste intact et prioritaire. La transformation est strictement visuelle :
le message stocké en session et envoyé au modèle reste inchangé.

> ◇ RÉPONSE ╶────────────────────────────────────┈┈
>
> La réponse importante reste immédiatement identifiable dans le transcript.

## Comportement

- un unique diamant creux et le label simple identifient la réponse sans
  capsule, fond, fermeture ou rails autour du texte ;
- le trait rejoint la même gouttière droite de 8 colonnes que les surfaces
  edit/write, sans plafond artificiel sur les terminaux larges ;
- sa couleur fond d'`accent` vers `muted`, puis son opacité est simulée en
  mélangeant le trait vers le fond thématique sur 34 % de sa longueur ;
- le trait conserve partout la même graisse light : seuls deux pointillés
  light `┈┈` ponctuent sa disparition ; aucune alternance d'épaisseur ;
- l'interpolation fonctionne en truecolor ou ANSI 256, sans fallback visuel ;
- sur les petits écrans, la composition devient un simple signal ;
- couleurs et emphase viennent du thème Pi actif, sans palette codée en dur ;
- les summaries Codex restent chacun sur leur ligne, regroupés par trois avec
  une seule ligne vide entre les groupes ;
- la prose complète conserve strictement sa mise en page ; dans les deux cas,
  seul le gras disparaît. Pi garde l'italique natif et `thinkingText: surface2` ;
- la transformation reste visuelle : contenu de session et messages utilisateur
  restent inchangés.
