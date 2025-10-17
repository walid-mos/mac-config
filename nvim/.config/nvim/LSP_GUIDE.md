# Guide LSP Neovim - Configuration Améliorée

Ce guide présente toutes les améliorations apportées à ta configuration LSP Neovim.

## 📦 Nouveaux Plugins Installés

### 1. **Trouble.nvim** - Visualisation avancée des diagnostics
- Liste des diagnostics workspace/buffer
- Navigation des références LSP avec preview
- Symbols et quickfix améliorés

### 2. **Conform.nvim** - Formatage automatique
- Prettier/Prettierd pour JS/TS/React/Vue
- Format on save avec fallback LSP
- Support multi-langages (Lua, Python, Go, Rust, etc.)

### 3. **TypeScript Tools** - Remplace ts_ls
- Meilleure performance
- Organize imports automatique
- Inlay hints améliorés

### 4. **LSP Signature** - Signatures pendant la frappe
- Affiche les paramètres de fonction en temps réel
- Highlight du paramètre actuel
- Floating window élégante

### 5. **Inc-Rename** - Rename avec preview
- Preview live pendant le renommage
- Intégration Telescope
- Confirmation avant application

### 6. **Dressing.nvim** - UI améliorée
- Input boxes stylisés
- Menus de sélection avec Telescope
- Meilleure expérience utilisateur

## 🎯 Nouveaux LSP Servers

Les serveurs suivants ont été ajoutés à ta configuration :

- **gopls** - Go language server
- **volar** - Vue language server
- **tailwindcss** - Tailwind CSS IntelliSense
- **yamlls** - YAML language server
- **dockerls** - Docker language server

Configuration automatique des schemas YAML pour GitHub Actions/Workflows.

## ⌨️ Keymaps LSP Modernisés

### Navigation LSP (Style Neovim 0.11+)

| Keymap | Action | Description |
|--------|--------|-------------|
| `gd` | Go to Definition | Ouvre la définition dans Telescope |
| `gD` | Go to Declaration | Va à la déclaration |
| `gi` | Go to Implementation | Ouvre l'implémentation dans Telescope |
| `gr` | Go to References (Telescope) | Liste les références avec Telescope |
| `grr` | Go to References (Trouble) | Liste les références avec Trouble |
| `gy` | Go to Type Definition | Ouvre la définition de type |

### Code Actions & Documentation

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>ca` | Code Action | Affiche les actions disponibles |
| `K` | Hover Documentation | Documentation du symbole |
| `gK` | Signature Help | Aide sur la signature |

### Renommage

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>rn` | Inc Rename | Rename avec preview live |

### Symbols & Navigation

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>ds` | Document Symbols | Symboles du fichier |
| `<leader>ws` | Workspace Symbols | Symboles du workspace |
| `<leader>cs` | Symbols (Trouble) | Vue Trouble des symboles |

### Diagnostics

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>cd` | Buffer Diagnostics | Diagnostics du buffer (Trouble) |
| `<leader>cD` | Workspace Diagnostics | Diagnostics du workspace (Trouble) |
| `<leader>ct` | Toggle Virtual Text | Active/désactive le virtual text |
| `<leader>xx` | Diagnostics (Trouble) | Workspace diagnostics |
| `<leader>xX` | Buffer Diagnostics (Trouble) | Buffer diagnostics |
| `[d` | Previous Diagnostic | Diagnostic précédent |
| `]d` | Next Diagnostic | Diagnostic suivant |
| `<leader>e` | Diagnostic Float | Ouvre diagnostic en float |

### Formatage (Conform)

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>cf` | Format Buffer | Formate le buffer actuel |
| `<leader>cF` | Toggle Autoformat | Active/désactive format on save |

### TypeScript Spécifique

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>co` | Organize Imports | Organise les imports |
| `<leader>cu` | Remove Unused Imports | Supprime les imports inutilisés |
| `<leader>cM` | Add Missing Imports | Ajoute les imports manquants |

### Trouble Navigation

| Keymap | Action | Description |
|--------|--------|-------------|
| `<leader>xr` | LSP References (Trouble) | Références LSP dans Trouble |
| `<leader>xL` | Location List | Liste de localisation |
| `<leader>xQ` | Quickfix List | Liste quickfix |

## 🚀 Fonctionnalités Ajoutées

### 1. Virtual Text Intelligent
- Affiche uniquement les warnings et errors inline
- Truncate les messages longs (max 80 chars)
- Toggle avec `<leader>ct`
- Hints/Info affichés uniquement dans float

### 2. Organize Imports Automatique (TypeScript)
- S'exécute automatiquement au save
- Commandes manuelles disponibles
- Support des monorepos

### 3. Inlay Hints
- Activés par défaut pour TypeScript
- Affiche les types de paramètres
- Affiche les types de variables
- Affiche les types de retour

### 4. Capabilities Améliorées
- Support des file operations (auto-import au rename)
- Snippets support amélioré
- Documentation markdown
- Resolve support pour additionalTextEdits

### 5. Format on Save
- Configuré pour tous les langages
- Utilise prettier/prettierd avec fallback
- Détecte les configs projet (.prettierrc, etc.)
- Toggle avec `<leader>cF`

## 📝 Formatters Configurés

| Langage | Formatter |
|---------|-----------|
| JavaScript/TypeScript | prettierd → prettier |
| React (JSX/TSX) | prettierd → prettier |
| Vue | prettierd → prettier |
| CSS/SCSS | prettierd → prettier |
| HTML | prettierd → prettier |
| JSON/JSONC | prettierd → prettier |
| YAML | prettierd → prettier |
| Markdown | prettierd → prettier |
| GraphQL | prettierd → prettier |
| Lua | stylua |
| Python | ruff_format |
| Go | gofumpt → goimports |
| Rust | rustfmt |
| Shell | shfmt |

## 🔧 Configuration Highlights

### Diagnostics
- Virtual text avec severity filter (WARN+)
- Source affichée si plusieurs LSP
- Messages truncated à 80 chars
- Float avec source toujours visible

### Tailwind CSS
- Support cva (class-variance-authority)
- Support cx helper
- IntelliSense dans les templates

### YAML
- Schemas GitHub Actions/Workflows
- Auto-validation

### Vue (Volar)
- Hybrid mode désactivé (meilleure performance)
- Support TypeScript dans `<script setup>`

### Go (gopls)
- Analyses améliorées (unused params)
- Staticcheck activé
- Gofumpt formatting

## 🎨 UI Améliorations

### Dressing.nvim
- Input boxes avec borders arrondis
- Transparence (winblend 10)
- Telescope pour les selects
- Cursor position relative

### Trouble.nvim
- Focus automatique
- Position droite pour LSP
- Integration Telescope results
- Icons avec nvim-web-devicons

### LSP Signature
- Floating window arrondie
- Transparence 10%
- Timer 200ms
- Toggle avec `<C-k>`

## 📦 Installation des Formatters

Pour que le formatage fonctionne, installe les formatters globalement :

```bash
# JavaScript/TypeScript
pnpm add -g prettier @fsouza/prettierd

# Lua
brew install stylua

# Python
pip install ruff

# Go
go install mvdan.cc/gofumpt@latest
go install golang.org/x/tools/cmd/goimports@latest

# Rust (installé avec rustup)
rustup component add rustfmt

# Shell
brew install shfmt
```

## 🔄 Migration Notes

### Changements Importants

1. **ts_ls → typescript-tools.nvim**
   - Meilleure performance
   - Plus de fonctionnalités TypeScript
   - Organize imports automatique

2. **Virtual Text Activé**
   - Uniquement WARN+ par défaut
   - Toggle avec `<leader>ct` si besoin

3. **Format on Save**
   - Activé par défaut
   - Désactiver avec `<leader>cF`

4. **Keymaps Standards**
   - `gd`, `gi`, `gr` suivent Neovim 0.11+
   - `grr` pour Trouble references
   - `gr` pour Telescope references

## 🎯 Workflow Recommandé

### Pour "Where is Used" (References)
1. `gr` → Telescope references (navigation rapide)
2. `grr` → Trouble references (vue d'ensemble avec preview)

### Pour Go to Definition
1. `gd` → Va à la définition (Telescope)
2. `<C-o>` → Retour en arrière
3. `<C-i>` → En avant

### Pour les Diagnostics
1. `<leader>cd` → Buffer diagnostics (Trouble)
2. `<leader>cD` → Workspace diagnostics (Trouble)
3. `[d` / `]d` → Navigation rapide
4. `<leader>e` → Float pour détails

### Pour le Renommage
1. `<leader>rn` → Inc-rename avec preview
2. Tape le nouveau nom
3. Enter pour confirmer

## 🐛 Troubleshooting

### Le formatage ne marche pas
```bash
# Vérifier les formatters installés
:ConformInfo

# Installer le formatter manquant (voir section Installation)
```

### LSP ne démarre pas
```bash
# Vérifier les LSP installés
:Mason

# Installer les serveurs manquants
```

### Organize imports ne marche pas
- S'assurer d'être dans un fichier TS/JS
- Vérifier que typescript-tools est chargé : `:LspInfo`

### Trouble ne s'ouvre pas
- S'assurer d'avoir des diagnostics/références
- Vérifier avec `:Trouble diagnostics toggle`

## 📚 Resources

- [Trouble.nvim Docs](https://github.com/folke/trouble.nvim)
- [Conform.nvim Docs](https://github.com/stevearc/conform.nvim)
- [TypeScript Tools Docs](https://github.com/pmizio/typescript-tools.nvim)
- [Inc-Rename Docs](https://github.com/smjonas/inc-rename.nvim)

---

**Configuration complète et optimisée pour 2025 insha'Allah! 🚀**
