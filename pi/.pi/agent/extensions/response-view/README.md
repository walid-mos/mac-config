# response-view — hiérarchie visuelle des réponses

Donne au Markdown produit par l'assistant une surface de lecture dont
l'intensité suit la nature du message. La réponse finale — celle qui n'est
suivie d'aucun tool call — est ouverte par un diamant creux en filigrane et un
trait accentué étiqueté ; aucun rail inférieur ne referme le contenu. Les
sorties intermédiaires entre deux tool calls se réduisent au même trait, sans
label ni accent. Le corps reste intact et prioritaire. La transformation est
strictement visuelle : le message stocké en session et envoyé au modèle reste
inchangé.

> ◇ RÉPONSE ╶────────────────────────────────────┈┈ ← réponse finale
>
> ╶─────────────────────────────────┈┈ ← sortie intermédiaire
>
> La réponse importante reste immédiatement identifiable dans le transcript.

## Comportement

- un message d'assistant contenant au moins un bloc `toolCall` est
  intermédiaire ; sans tool call, il est final ;
- pendant le streaming, le statut est inconnu : la prose garde le traitement
  minimal jusqu'à la fin du message, où le re-rendu révèle l'en-tête si la
  réponse est finale ;
- la qualification survit à la reprise de session : au `session_start`, la
  branche active est relue depuis le session manager, et chaque `message_end`
  d'assistant met à jour l'état (empreinte SHA-256 des blocs texte) ;
- un unique diamant creux et le label simple identifient la réponse finale sans
  capsule, fond, fermeture ou rails autour du texte ;
- les sorties intermédiaires n'ont ni diamant ni label : uniquement le trait
  `muted` du thème, pleine largeur, avec le même fondu final vers le fond ;
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
