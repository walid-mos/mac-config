# Guide de Navigation Ghostty ↔ Neovim

Ce guide explique comment naviguer entre les panes Ghostty et les splits Neovim avec des keybinds séparés.

## 🎯 Philosophie

- **Alt+hjkl** = Navigation Ghostty (panes du terminal)
- **Ctrl+hjkl** = Navigation Neovim (splits de l'éditeur)
- **Shift+hjkl** = Resize (quelle que soit la couche)

## 🖥️ Ghostty (Panes - Niveau Terminal)

### Navigation
| Keymap | Action |
|--------|--------|
| `Alt+h` | Aller au pane de gauche |
| `Alt+j` | Aller au pane du bas |
| `Alt+k` | Aller au pane du haut |
| `Alt+l` | Aller au pane de droite |

### Gestion des Panes
| Keymap | Action |
|--------|--------|
| `Alt+n` | Créer split vertical (droite) |
| `Alt+v` | Créer split horizontal (bas) |
| `Alt+x` | Fermer le pane actuel |

### Resize
| Keymap | Action |
|--------|--------|
| `Alt+Shift+h` | Réduire largeur gauche (10px) |
| `Alt+Shift+j` | Augmenter hauteur bas (5px) |
| `Alt+Shift+k` | Réduire hauteur haut (5px) |
| `Alt+Shift+l` | Augmenter largeur droite (10px) |

### Autres
| Keymap | Action |
|--------|--------|
| `Alt+[` | Tab précédent |
| `Alt+]` | Tab suivant |
| `Alt+q` | Toggle inspector |

## 📝 Neovim (Splits - Niveau Éditeur)

### Navigation
| Keymap | Action |
|--------|--------|
| `Ctrl+h` | Aller au split de gauche |
| `Ctrl+j` | Aller au split du bas |
| `Ctrl+k` | Aller au split du haut |
| `Ctrl+l` | Aller au split de droite |

### Création de Splits
| Keymap | Action |
|--------|--------|
| `ss` | Créer split vertical |
| `sv` | Créer split horizontal |

### Resize
| Keymap | Action |
|--------|--------|
| `Ctrl+Shift+h` | Réduire largeur (3px) |
| `Ctrl+Shift+j` | Augmenter hauteur (3px) |
| `Ctrl+Shift+k` | Réduire hauteur (3px) |
| `Ctrl+Shift+l` | Augmenter largeur (3px) |

## 🧠 Muscle Memory

### Scenario 1 : Navigation dans Ghostty seul
```
Pane 1 | Pane 2 | Pane 3
```
- `Alt+l` → Va de Pane 1 à Pane 2
- `Alt+l` → Va de Pane 2 à Pane 3
- `Alt+h` → Retour à Pane 2

### Scenario 2 : Navigation dans Neovim avec splits
```
Pane Ghostty unique avec Neovim ouvert:
┌─────────┬─────────┐
│ Split 1 │ Split 2 │
├─────────┴─────────┤
│     Split 3       │
└───────────────────┘
```
- `Ctrl+l` → Va de Split 1 à Split 2
- `Ctrl+j` → Va à Split 3
- `Ctrl+k` → Retour en haut

### Scenario 3 : Ghostty + Neovim (cas complexe)
```
┌─────────────┬──────────────┐
│   Pane 1    │   Pane 2     │
│   (shell)   │   (Neovim)   │
│             │ ┌─────┬─────┐│
│             │ │Sp 1 │Sp 2 ││
│             │ └─────┴─────┘│
└─────────────┴──────────────┘
```

**Dans Pane 1 (shell) :**
- `Alt+l` → Va au Pane 2 (Neovim)

**Dans Pane 2, Split 1 de Neovim :**
- `Ctrl+l` → Va au Split 2 de Neovim (reste dans Pane 2)
- `Alt+h` → Va au Pane 1 (quitte Neovim)

**Clé** : Alt traverse les panes Ghostty, Ctrl reste dans Neovim

## 📊 Comparaison Rapide

| Action | Ghostty | Neovim |
|--------|---------|--------|
| Navigation | `Alt+hjkl` | `Ctrl+hjkl` |
| Créer split | `Alt+n/v` | `ss/sv` |
| Fermer | `Alt+x` | `<leader>C` |
| Resize | `Alt+Shift+hjkl` | `Ctrl+Shift+hjkl` |

## 🎓 Tips

1. **Pense en couches** : Alt = couche terminal, Ctrl = couche éditeur
2. **Utilise Ctrl dans Neovim** : Même si tu n'as qu'un seul pane Ghostty
3. **Utilise Alt pour changer de pane** : Même si Neovim a des splits
4. **Resize avec Shift** : Toujours combiné avec la touche de navigation

## 🔧 Configuration

- **Ghostty** : `~/.config/ghostty/keys`
- **Neovim** : `~/.config/nvim/lua/plugins/explorer/smart-splits.lua`

## ⚠️ Notes Importantes

1. **Pas de navigation seamless** : Tu dois consciemment choisir Alt (Ghostty) ou Ctrl (Neovim)
2. **Avantage** : Aucun conflit, comportement prévisible
3. **Désavantage** : Deux ensembles de touches à retenir

---

**Configuration optimisée pour productivité maximale ! 🚀**
