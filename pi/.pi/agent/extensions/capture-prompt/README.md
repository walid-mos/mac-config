# capture-prompt

Les images collées avec `Ctrl+V` ou déposées dans l’éditeur sont remplacées par
des références courtes (`[img:1]`, `[img:2]`, …) et envoyées au modèle comme de
vraies pièces jointes multimodales.

Au-dessus du prompt, une bande de miniatures encadrées associe chaque image à sa
référence. Chaque image occupe 10 colonnes au maximum. Si la largeur du terminal
ne suffit pas, `Ctrl+Shift+←` et `Ctrl+Shift+→` font défiler la bande. Dans
l’éditeur, les références `[img:N]` sont rendues en gras avec la couleur d’accent.

Formats pris en charge : PNG, JPEG, GIF et WebP, jusqu’à 20 Mio par image. Dans
un terminal sans protocole d’image (notamment sous tmux), la bande se replie sur
la liste compacte des références.
