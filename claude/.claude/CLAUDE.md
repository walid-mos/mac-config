@RTK.md
@TERSE.md

# Découpe en stack de PR

Toute branche ou worktree destinée à une PR se découpe dès le départ en un stack
de PR lisibles, pas en une PR géante en fin de course. Un maillon = une branche +
une PR, empilés comme des commits. Budget mou par maillon : rarement plus de ~20
fichiers ou ~1000 lignes changées. Regrouper ce qui est fortement couplé, éclater
par couche ce qui est trop gros ; jamais couper au milieu d'un état qui ne compile
pas. Vaut pour `/goal` et le dev client hors Plane. Le skill `stack` porte la
procédure complète (`gh stack` : init → add par maillon → submit unique en fin) ;
`ship` fait pareil quand le projet est sous Plane.

# Commentaires de code

Aucun commentaire, sauf contrainte métier ou invariant que le code ne peut pas exprimer (règle réglementaire, workaround d'un bug upstream avec lien, invariant non évident). Jamais de commentaires narratifs (« on fait X », « fix de Y », « appelle Z »), de paraphrase du code, ni de commentaires adressés au reviewer. S'applique aussi aux subagents. En cas de doute, ne commente pas — renomme ou extrais à la place.
