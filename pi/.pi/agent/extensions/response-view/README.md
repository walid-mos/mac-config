# response-view — hiérarchie visuelle des réponses

Ajoute un séparateur fin et labellisé autour du Markdown produit par
l'assistant. La transformation est strictement visuelle : le message stocké en
session et envoyé au modèle reste inchangé.

```text
╭─ réponse ─────────────────────────────────────────────────

La réponse importante reste immédiatement identifiable dans le transcript.

╰───────────────────────────────────────────────────────────
```

## Comportement

- pendant le streaming, seul le bord supérieur est visible : la surface reste
  ouverte tant que la réponse grandit ;
- à la fin du message, un bord inférieur discret ferme la réponse ;
- la règle est plafonnée à 88 colonnes pour garder une mesure élégante sur les
  terminaux ultra-larges et se réduit sur les petits écrans ;
- couleurs et emphase viennent du thème Pi actif, sans palette codée en dur ;
- les summaries Codex restent chacun sur leur ligne, regroupés par trois avec
  une seule ligne vide entre les groupes ;
- la prose complète conserve strictement sa mise en page ; dans les deux cas,
  seul le gras disparaît. Pi garde l'italique natif et `thinkingText: surface2` ;
- la transformation reste visuelle : contenu de session et messages utilisateur
  restent inchangés.
